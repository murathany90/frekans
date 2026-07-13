from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.discover_teias import discover_teias_entries
from scripts.fetch_teias import process_entry, write_status
from scripts.normalize_frequency import build_manifest, utc_now_iso


def date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def run_teias_backfill(output_root: Path, request_delay: float = 0.25) -> dict:
    import time

    entries = discover_teias_entries()
    by_date = {entry.local_date: entry for entry in entries if entry.local_date.startswith("2026-")}
    end = min(date.today(), date(2026, 12, 31))
    report = {
        "source": "teias",
        "year": 2026,
        "startedAtUtc": utc_now_iso(),
        "finishedAtUtc": None,
        "processed": [],
        "notPublished": [],
        "failed": [],
    }
    for index, day in enumerate(date_range(date(2026, 1, 1), end)):
        iso = day.isoformat()
        entry = by_date.get(iso)
        if not entry:
            report["notPublished"].append(iso)
            continue
        try:
            report["processed"].append(process_entry(entry, output_root))
        except Exception as error:  # noqa: BLE001
            report["failed"].append({"date": iso, "error": str(error)})
        if index and index % 40 == 0:
            write_reports(report)
        time.sleep(request_delay)
    report["finishedAtUtc"] = utc_now_iso()
    build_manifest(output_root)
    write_status(
        output_root,
        {
            "processed": report["processed"],
            "missing": report["notPublished"],
            "failed": [f"{item['date']}: {item['error']}" for item in report["failed"]],
        },
    )
    write_reports(report)
    return report


def write_reports(report: dict) -> None:
    root = Path("reports/data_quality")
    root.mkdir(parents=True, exist_ok=True)
    (root / "teias_2026_backfill.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    lines = [
        "# TEIAS 2026 Backfill Report",
        "",
        f"- Source: {report['source']}",
        f"- Processed days: {len(report['processed'])}",
        f"- Not published days: {len(report['notPublished'])}",
        f"- Failed days: {len(report['failed'])}",
        f"- Started UTC: {report['startedAtUtc']}",
        f"- Finished UTC: {report.get('finishedAtUtc') or 'running'}",
        "",
        "## Not Published",
        "",
        ", ".join(report["notPublished"]) if report["notPublished"] else "None",
        "",
        "## Failed",
        "",
        "\n".join(f"- {item['date']}: {item['error']}" for item in report["failed"]) or "None",
    ]
    (root / "teias_2026_backfill.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill TEIAS 2026 frequency data.")
    parser.add_argument("--source", choices=["teias"], required=True)
    parser.add_argument("--output-root", default="data")
    parser.add_argument("--request-delay", type=float, default=0.25)
    args = parser.parse_args()
    print(json.dumps(run_teias_backfill(Path(args.output_root), args.request_delay), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
