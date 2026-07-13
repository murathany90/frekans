from __future__ import annotations

import argparse
from datetime import UTC, datetime
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.fetch_teias import write_status


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge TEIAS workflow status into data/status.json.")
    parser.add_argument("--data-root", default="data")
    parser.add_argument("--result", choices=["success", "partial", "failed"], required=True)
    parser.add_argument("--step", default="TEIAS daily update")
    parser.add_argument("--message", default="")
    parser.add_argument("--attempted-date", default="")
    parser.add_argument("--http-status", type=int)
    parser.add_argument("--retry-count", type=int, default=3)
    args = parser.parse_args()

    run_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    failed = []
    if args.result == "failed":
        failed.append(args.message or "TEIAS workflow failed")
    write_status(
        Path(args.data_root),
        {
            "processed": [],
            "missing": [args.attempted_date] if args.attempted_date else [],
            "failed": failed,
            "attemptedDate": args.attempted_date or None,
            "workflowRunAt": run_at,
            "errorStep": args.step,
            "httpStatus": args.http_status,
            "retryCount": args.retry_count,
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
