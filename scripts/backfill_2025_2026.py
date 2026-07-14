from __future__ import annotations

import argparse
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Iterable

BACKFILL_START = date(2025, 1, 1)
BACKFILL_END = date(2026, 7, 10)
SOURCE_LABELS = {
    "teias": "TEIAS",
    "netztransparenz": "Netztransparenz",
}
RAW_SUFFIXES = {".zip", ".csv", ".tmp", ".part"}
RAW_DIR_NAMES = {"incoming", "cache", "tmp", "downloads", "raw"}
PAGES_LIMIT_BYTES = 1024 * 1024 * 1024
WARN_DIST_BYTES = 850 * 1024 * 1024
MAX_FILE_BYTES = 50 * 1024 * 1024


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def all_dates(start: date = BACKFILL_START, end: date = BACKFILL_END) -> list[str]:
    if end < start:
        return []
    return [(start + timedelta(days=offset)).isoformat() for offset in range((end - start).days + 1)]


def directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def size_snapshot(repo_root: Path = Path("."), dist_root: Path = Path("dist"), data_root: Path = Path("data")) -> dict[str, int]:
    return {
        "repoBytes": directory_size(repo_root),
        "dataBytes": directory_size(data_root),
        "distBytes": directory_size(dist_root),
    }


def index_paths(data_root: Path, source: str) -> list[Path]:
    return sorted((data_root / source).glob("20??/index.json"))


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def collect_source_index(data_root: Path, source: str) -> dict[str, dict]:
    records: dict[str, dict] = {}
    for path in index_paths(data_root, source):
        if not path.exists():
            continue
        index = read_json(path)
        for local_date in index.get("availableDates", []):
            day = dict(index.get("days", {}).get(local_date, {}))
            day["status"] = "available"
            records[local_date] = day
        excluded_days = index.get("excludedDays", {})
        for local_date in index.get("excludedDates", []):
            day = dict(excluded_days.get(local_date, {}))
            day["status"] = "invalid_quality"
            records[local_date] = day
    return records


def disk_frequency_dates(data_root: Path, source: str) -> set[str]:
    dates: set[str] = set()
    for path in (data_root / source).glob("20??/[01][0-9]/*.frequency.i16"):
        stem = path.name.split(".")[0]
        if len(stem) == 8 and stem.isdigit():
            dates.add(f"{stem[:4]}-{stem[4:6]}-{stem[6:8]}")
    return dates


def expected_files_exist(data_root: Path, source: str, local_date: str) -> bool:
    stem = local_date.replace("-", "")
    base = data_root / source / local_date[:4] / local_date[5:7]
    return all(
        (base / f"{stem}.{suffix}").exists()
        for suffix in ("frequency.i16", "minute.json", "hourly.json", "meta.json")
    )


def source_inventory(data_root: Path, source: str, days: list[str]) -> dict:
    indexed = collect_source_index(data_root, source)
    disk_dates = disk_frequency_dates(data_root, source)
    by_date: dict[str, dict] = {}
    disk_not_manifest: list[str] = []
    manifest_missing_file: list[str] = []
    partial_dates: list[str] = []

    for local_date in days:
        record = indexed.get(local_date)
        if record:
            status = record.get("status", "available")
            if status == "available" and not expected_files_exist(data_root, source, local_date):
                status = "validation_failed"
                manifest_missing_file.append(local_date)
            if str(record.get("status", "")).lower() == "partial" or record.get("validSamples", 0) < record.get("expectedSamples", 0):
                partial_dates.append(local_date)
            by_date[local_date] = {
                "date": local_date,
                "status": status,
                "manifestStatus": record.get("status"),
                "validSamples": record.get("validSamples"),
                "expectedSamples": record.get("expectedSamples"),
                "qualityScore": record.get("qualityScore"),
            }
        elif local_date in disk_dates:
            disk_not_manifest.append(local_date)
            by_date[local_date] = {"date": local_date, "status": "missing_locally"}
        else:
            by_date[local_date] = {"date": local_date, "status": "source_not_found"}

    counts: dict[str, int] = {}
    for item in by_date.values():
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    return {
        "label": SOURCE_LABELS[source],
        "requestedDays": len(days),
        "byDate": by_date,
        "counts": counts,
        "availableDates": [day for day, item in by_date.items() if item["status"] == "available"],
        "invalidDates": [day for day, item in by_date.items() if item["status"] == "invalid_quality"],
        "missingDates": [day for day, item in by_date.items() if item["status"] != "available"],
        "diskNotManifestDates": disk_not_manifest,
        "manifestMissingFileDates": manifest_missing_file,
        "partialCoverageDates": partial_dates,
        "statusRanges": group_status_ranges((day, item["status"]) for day, item in by_date.items()),
    }


def inventory_data_root(
    data_root: str | Path = "data",
    start: date = BACKFILL_START,
    end: date = BACKFILL_END,
) -> dict:
    root = Path(data_root)
    days = all_dates(start, end)
    sources = {
        source: source_inventory(root, source, days)
        for source in ("teias", "netztransparenz")
    }
    teias_available = set(sources["teias"]["availableDates"])
    netz_available = set(sources["netztransparenz"]["availableDates"])
    both_missing = [
        day for day in days
        if sources["teias"]["byDate"][day]["status"] != "available"
        and sources["netztransparenz"]["byDate"][day]["status"] != "available"
    ]
    return {
        "range": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "totalDays": len(days),
        },
        "generatedAtUtc": utc_now_iso(),
        "sources": sources,
        "commonDates": sorted(teias_available & netz_available),
        "onlyTeiasDates": sorted(teias_available - netz_available),
        "onlyNetztransparenzDates": sorted(netz_available - teias_available),
        "bothMissingDates": both_missing,
    }


def group_status_ranges(items: Iterable[tuple[str, str]]) -> list[dict[str, object]]:
    ranges: list[dict[str, object]] = []
    previous_day: date | None = None
    current: dict[str, object] | None = None
    for local_date, status in sorted(items):
        day = parse_iso(local_date)
        if current and previous_day and day == previous_day + timedelta(days=1) and current["status"] == status:
            current["end"] = local_date
            current["count"] = int(current["count"]) + 1
        else:
            current = {"start": local_date, "end": local_date, "status": status, "count": 1}
            ranges.append(current)
        previous_day = day
    return ranges


def markdown_range_line(range_item: dict[str, object], label: str) -> str:
    start = str(range_item["start"])
    end = str(range_item["end"])
    period = start if start == end else f"{start}-{end}"
    return f"{period} - {label} - {range_item['status']}"


def coverage_percent(available: int, requested: int) -> float:
    return round(100 * available / requested, 2) if requested else 0.0


def write_backfill_reports(
    inventory: dict,
    report_root: str | Path = Path("reports/data_quality"),
    *,
    size_report: dict[str, int] | None = None,
    download_stats: dict[str, object] | None = None,
) -> dict[str, Path]:
    root = Path(report_root)
    root.mkdir(parents=True, exist_ok=True)
    size_report = size_report or {}
    download_stats = download_stats or {
        "apiRequests": 0,
        "zipDownloads": 0,
        "retries": 0,
        "http429": 0,
        "http4xx5xx": 0,
        "methods": [],
    }
    json_path = root / "backfill_2025_2026.json"
    md_path = root / "backfill_2025_2026.md"
    payload = {
        **inventory,
        "size": size_report,
        "downloadStats": download_stats,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# 2025-2026 Frequency Backfill Report",
        "",
        f"Generated at UTC: {inventory['generatedAtUtc']}",
        f"Range: {inventory['range']['start']} - {inventory['range']['end']} ({inventory['range']['totalDays']} days)",
        "",
        "## Coverage",
        "",
        "| Source | Requested days | Available days | Missing days | Invalid days | Coverage |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for source, source_info in inventory["sources"].items():
        counts = source_info["counts"]
        available = counts.get("available", 0)
        invalid = counts.get("invalid_quality", 0)
        missing = source_info["requestedDays"] - available - invalid
        lines.append(
            f"| {source_info['label']} | {source_info['requestedDays']} | {available} | {missing} | {invalid} | {coverage_percent(available, source_info['requestedDays'])}% |"
        )
    common = len(inventory["commonDates"])
    common_gap = inventory["range"]["totalDays"] - common
    lines.append(
        f"| Common | {inventory['range']['totalDays']} | {common} | {common_gap} | 0 | {coverage_percent(common, inventory['range']['totalDays'])}% |"
    )
    lines.extend(["", "## Missing And Invalid Date Ranges", ""])
    for source, source_info in inventory["sources"].items():
        lines.extend([f"### {source_info['label']}", ""])
        for range_item in source_info["statusRanges"]:
            if range_item["status"] != "available":
                lines.append(markdown_range_line(range_item, source_info["label"]))
        lines.append("")
    lines.extend(
        [
            "### Joint",
            "",
            f"Both valid days: {len(inventory['commonDates'])}",
            f"Only TEIAS days: {len(inventory['onlyTeiasDates'])}",
            f"Only Netztransparenz days: {len(inventory['onlyNetztransparenzDates'])}",
            f"Both missing days: {len(inventory['bothMissingDates'])}",
            "",
            "## Size",
            "",
            f"Repo before bytes: {size_report.get('repoBeforeBytes', 0)}",
            f"Repo after bytes: {size_report.get('repoAfterBytes', 0)}",
            f"Dist before bytes: {size_report.get('distBeforeBytes', 0)}",
            f"Dist after bytes: {size_report.get('distAfterBytes', 0)}",
            f"Added bytes: {size_report.get('addedBytes', 0)}",
            f"Added file count: {size_report.get('addedFileCount', 0)}",
            f"Pages remaining bytes: {size_report.get('pagesRemainingBytes', 0)}",
            "",
            "## Download",
            "",
            f"API requests: {download_stats.get('apiRequests', 0)}",
            f"ZIP downloads: {download_stats.get('zipDownloads', 0)}",
            f"Retries: {download_stats.get('retries', 0)}",
            f"HTTP 429: {download_stats.get('http429', 0)}",
            f"HTTP 4xx/5xx: {download_stats.get('http4xx5xx', 0)}",
            f"Methods: {', '.join(download_stats.get('methods', []))}",
            "",
            "## Security",
            "",
            "- Raw source files are not required in published dist.",
            "- Secrets and OAuth tokens are not written by this report.",
            "- Browser data loading is guarded by lazy yearly shards and day-level fetches.",
        ]
    )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"json": json_path, "markdown": md_path}


def checkpoint_payload(
    inventory: dict,
    *,
    last_completed_source: str = "",
    last_completed_date: str = "",
) -> dict[str, object]:
    completed = []
    failed = []
    for source, source_info in inventory["sources"].items():
        for local_date, item in source_info["byDate"].items():
            target = completed if item["status"] == "available" else failed
            target.append({"source": source, "date": local_date, "status": item["status"]})
    return {
        "rangeStart": inventory["range"]["start"],
        "rangeEnd": inventory["range"]["end"],
        "lastCompletedSource": last_completed_source,
        "lastCompletedDate": last_completed_date,
        "completedDates": completed,
        "failedDates": failed,
        "updatedAtUtc": utc_now_iso(),
    }


def write_checkpoint(path: str | Path, payload: dict[str, object]) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target


def assert_publishable_dist(
    dist_root: str | Path = "dist",
    *,
    max_total_bytes: int = WARN_DIST_BYTES,
    max_file_bytes: int = MAX_FILE_BYTES,
) -> dict[str, object]:
    root = Path(dist_root)
    if not root.exists():
        raise ValueError(f"dist path does not exist: {root}")
    total = 0
    largest = {"path": "", "bytes": 0}
    raw_matches: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        size = path.stat().st_size
        total += size
        if size > largest["bytes"]:
            largest = {"path": relative, "bytes": size}
        parts = {part.lower() for part in path.relative_to(root).parts}
        if path.suffix.lower() in RAW_SUFFIXES or parts & RAW_DIR_NAMES:
            raw_matches.append(relative)
    if raw_matches:
        raise ValueError(f"raw source files are not publishable: {raw_matches[:10]}")
    if largest["bytes"] > max_file_bytes:
        raise ValueError(f"single file exceeds publish limit: {largest['path']} ({largest['bytes']} bytes)")
    if total > max_total_bytes:
        raise ValueError(f"dist exceeds publish warning threshold: {total} bytes")
    return {
        "distBytes": total,
        "largestFile": largest,
        "pagesRemainingBytes": PAGES_LIMIT_BYTES - total,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inventory and report 2025-2026 TEIAS/Netztransparenz backfill status.")
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--report-root", default="reports/data_quality")
    parser.add_argument("--checkpoint", default="reports/data_quality/backfill_2025_2026.checkpoint.json")
    parser.add_argument("--start", default=BACKFILL_START.isoformat())
    parser.add_argument("--end", default=BACKFILL_END.isoformat())
    parser.add_argument("--repo-before-bytes", type=int, default=0)
    parser.add_argument("--dist-before-bytes", type=int, default=0)
    parser.add_argument("--repo-after-bytes", type=int, default=0)
    parser.add_argument("--dist-after-bytes", type=int, default=0)
    parser.add_argument("--added-bytes", type=int, default=0)
    parser.add_argument("--added-file-count", type=int, default=0)
    parser.add_argument("--zip-downloads", type=int, default=0)
    parser.add_argument("--api-requests", type=int, default=0)
    parser.add_argument("--retries", type=int, default=0)
    parser.add_argument("--http-429", type=int, default=0)
    parser.add_argument("--http-4xx-5xx", type=int, default=0)
    parser.add_argument("--method", action="append", default=[])
    return parser


def main() -> int:
    args = build_parser().parse_args()
    start = parse_iso(args.start)
    end = parse_iso(args.end)
    inventory = inventory_data_root(args.data_root, start, end)
    size_report = {
        "repoBeforeBytes": args.repo_before_bytes,
        "repoAfterBytes": args.repo_after_bytes,
        "distBeforeBytes": args.dist_before_bytes,
        "distAfterBytes": args.dist_after_bytes,
        "addedBytes": args.added_bytes,
        "addedFileCount": args.added_file_count,
        "pagesRemainingBytes": PAGES_LIMIT_BYTES - max(0, args.dist_after_bytes),
    }
    download_stats = {
        "apiRequests": args.api_requests,
        "zipDownloads": args.zip_downloads,
        "retries": args.retries,
        "http429": args.http_429,
        "http4xx5xx": args.http_4xx_5xx,
        "methods": args.method,
    }
    paths = write_backfill_reports(inventory, args.report_root, size_report=size_report, download_stats=download_stats)
    write_checkpoint(args.checkpoint, checkpoint_payload(inventory))
    print(json.dumps({"reports": {key: str(value) for key, value in paths.items()}, "checkpoint": args.checkpoint}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
