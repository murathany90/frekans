from __future__ import annotations

import argparse
import json
import time
import zipfile
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.discover_teias import TeiasEntry, discover_teias_entries
from scripts.normalize_frequency import build_manifest, parse_teias_csv, write_day_outputs


def parse_iso_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def date_range(start: date, end: date) -> list[date]:
    if end < start:
        return []
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def select_entries(args: argparse.Namespace, entries: list[TeiasEntry]) -> tuple[list[TeiasEntry], list[str]]:
    by_date = {entry.local_date: entry for entry in entries}
    missing: list[str] = []
    if args.latest:
        return ([entries[-1]] if entries else []), missing
    if args.date:
        selected_date = parse_iso_date(args.date).isoformat()
        return ([by_date[selected_date]] if selected_date in by_date else []), ([] if selected_date in by_date else [selected_date])
    if args.lookback_days:
        end = date.today()
        start = end - timedelta(days=max(0, int(args.lookback_days) - 1))
    else:
        start = parse_iso_date(args.start) if args.start else date(2026, 1, 1)
        end = parse_iso_date(args.end) if args.end else date.today()
    selected: list[TeiasEntry] = []
    for day in date_range(start, min(end, date.today())):
        iso = day.isoformat()
        if iso in by_date:
            selected.append(by_date[iso])
        else:
            missing.append(iso)
    return selected, missing


def download_entry(entry: TeiasEntry, timeout: int = 60, retries: int = 3) -> tuple[bytes, int]:
    headers = {"User-Agent": "zfrekans-rapor-data-bot/1.0"}
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = Request(entry.file_url, headers=headers)
            with urlopen(request, timeout=timeout) as response:
                return response.read(), int(response.status)
        except HTTPError as error:
            last_error = error
            if error.code not in (429, 500, 502, 503, 504):
                raise
        except URLError as error:
            last_error = error
        time.sleep(min(10, 2**attempt))
    raise RuntimeError(f"TEIAS download failed for {entry.local_date}: {last_error}")


def unpack_if_zip(data: bytes) -> bytes:
    if not data.startswith(b"PK"):
        return data
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith((".csv", ".txt"))]
        if not names:
            raise ValueError("TEIAS zip file did not contain a csv/txt file")
        return archive.read(names[0])


def existing_meta_hash(data_root: Path, entry: TeiasEntry) -> str | None:
    stem = entry.local_date.replace("-", "")
    path = data_root / "teias" / entry.local_date[0:4] / entry.local_date[5:7] / f"{stem}.meta.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("sha256")
    except json.JSONDecodeError:
        return None


def process_entry(entry: TeiasEntry, data_root: Path, dry_run: bool = False) -> dict:
    if dry_run:
        return {"date": entry.local_date, "status": "dry_run", "url": entry.file_url}
    raw_data, status = download_entry(entry)
    parse_data = unpack_if_zip(raw_data)
    package = parse_teias_csv(parse_data, source_url=entry.file_url, http_status=status, fallback_date=entry.local_date)
    previous_hash = existing_meta_hash(data_root, entry)
    if previous_hash == package.sha256:
        return {"date": entry.local_date, "status": "unchanged", "sha256": package.sha256}
    if previous_hash:
        package.meta["previousSha256"] = previous_hash
        package.meta["revisionDetected"] = True
    write_day_outputs(package, data_root)
    return {
        "date": entry.local_date,
        "status": package.status,
        "sha256": package.sha256,
        "validSamples": package.valid_samples,
        "qualityScore": package.quality_score,
        "revision": bool(previous_hash and previous_hash != package.sha256),
    }


def write_status(data_root: Path, summary: dict) -> None:
    path = data_root / "status.json"
    previous = {}
    if path.exists():
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = {}
    now_utc = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    run_at = summary.get("workflowRunAt") or now_utc
    successful_dates = [item["date"] for item in summary["processed"] if item["status"] not in ("dry_run", "error")]
    if previous.get("lastSuccessfulTeiasDataDate"):
        successful_dates.append(previous["lastSuccessfulTeiasDataDate"])
    if previous.get("lastSuccessfulDataDate"):
        successful_dates.append(previous["lastSuccessfulDataDate"])
    latest_success = max(successful_dates, default=None)
    attempted_dates = [item["date"] for item in summary.get("processed", []) if item.get("date")]
    attempted_dates.extend(summary.get("missing", []))
    attempted_date = summary.get("attemptedDate") or max(attempted_dates, default=previous.get("lastAttemptedDataDate"))
    netz_index = data_root / "netztransparenz" / "2026" / "index.json"
    latest_netz = previous.get("lastSuccessfulNetztransparenzDataDate")
    if netz_index.exists():
        try:
            latest_netz = json.loads(netz_index.read_text(encoding="utf-8")).get("availableDates", [])[-1]
        except (IndexError, json.JSONDecodeError):
            pass
    data_delay_days = None
    if latest_success:
        data_delay_days = (datetime.now(UTC).date() - parse_iso_date(latest_success)).days
    failed_messages = summary.get("failed", [])
    has_failed = bool(failed_messages)
    has_success_this_run = bool([item for item in summary.get("processed", []) if item.get("status") not in ("dry_run", "error")])
    prompt2_status = "partial" if has_failed and has_success_this_run else "failed" if has_failed else "success"
    error_message = "; ".join(failed_messages)
    last_error = (
        {
            "step": summary.get("errorStep") or "TEIAS daily update",
            "message": error_message,
            "httpStatus": summary.get("httpStatus"),
            "retryCount": summary.get("retryCount"),
        }
        if has_failed
        else None
    )
    status = {
        **previous,
        "updatedAtUtc": run_at,
        "lastRunAt": run_at,
        "lastSuccessfulRunAt": run_at if not has_failed else previous.get("lastSuccessfulRunAt"),
        "lastFailedRunAt": run_at if has_failed else previous.get("lastFailedRunAt"),
        "lastSuccessfulDataDate": latest_success,
        "lastAttemptedDataDate": attempted_date,
        "status": prompt2_status,
        "missingDates": summary.get("missing", []),
        "lastError": last_error,
        "lastWorkflowResult": prompt2_status,
        "lastSuccessfulTeiasCheckUtc": run_at if not has_failed else previous.get("lastSuccessfulTeiasCheckUtc"),
        "lastSuccessfulTeiasDataDate": latest_success,
        "lastSuccessfulNetztransparenzDataDate": latest_netz,
        "teiasDataDelayDays": data_delay_days,
        "lastTeiasLookback": summary.get("missing", []),
        "missingDayCount": len(summary.get("missing", [])),
        "qualityWarnings": [item for item in summary["processed"] if item.get("qualityScore", 100) < 95],
        "revisionDates": [item for item in summary["processed"] if item.get("revision")],
        "lastErrorMessage": error_message if has_failed else None,
        "lastErrorAtUtc": run_at if has_failed else None,
    }
    path.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(args: argparse.Namespace) -> dict:
    data_root = Path(args.output_root)
    entries = discover_teias_entries()
    selected, missing = select_entries(args, entries)
    attempted_dates = [entry.local_date for entry in selected] + missing
    summary = {
        "processed": [],
        "missing": missing,
        "failed": [],
        "attemptedDate": max(attempted_dates, default=None),
        "workflowRunAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "retryCount": 3,
    }
    for index, entry in enumerate(selected):
        try:
            summary["processed"].append(process_entry(entry, data_root, dry_run=args.dry_run))
        except Exception as error:  # noqa: BLE001 - CLI summary should continue across days
            summary["failed"].append(f"{entry.local_date}: {error}")
        if not args.dry_run and index < len(selected) - 1:
            time.sleep(float(args.request_delay))
    if not args.dry_run:
        build_manifest(data_root)
        write_status(data_root, summary)
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch and normalize TEIAS daily frequency files.")
    parser.add_argument("--date")
    parser.add_argument("--start")
    parser.add_argument("--end")
    parser.add_argument("--lookback-days", type=int)
    parser.add_argument("--latest", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output-root", default="data")
    parser.add_argument("--request-delay", default="0.25")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    print(json.dumps(run(args), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
