from __future__ import annotations

import argparse
import csv
import io
import json
from datetime import datetime
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.normalize_frequency import (
    NETZTRANSPARENZ_TIMEZONE,
    build_manifest,
    build_day_package,
    normalize_date,
    parse_frequency,
    sha256_bytes,
    time_to_second,
    utc_now_iso,
)


def sniff_delimiter(sample: str) -> str:
    candidates = [";", ",", "\t"]
    return max(candidates, key=sample.count)


def detect_columns(header: list[str]) -> tuple[int, int, int] | None:
    lowered = [cell.strip().lower() for cell in header]
    date_index = next((i for i, cell in enumerate(lowered) if "date" in cell or "datum" in cell), -1)
    time_index = next((i for i, cell in enumerate(lowered) if "time" in cell or "zeit" in cell), -1)
    freq_index = next((i for i, cell in enumerate(lowered) if "frequency" in cell or "frequenz" in cell), -1)
    if min(date_index, time_index, freq_index) >= 0:
        return date_index, time_index, freq_index
    return None


def parse_netztransparenz_csv(
    data: bytes,
    *,
    source_url: str,
    downloaded_at_utc: str | None = None,
) -> dict[str, object]:
    text = data.decode("utf-8-sig", errors="replace")
    delimiter = sniff_delimiter(text[:4096])
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        return {}

    columns = detect_columns(rows[0])
    start_index = 1 if columns else 0
    if columns is None:
        columns = (0, 1, 2)

    by_day: dict[str, dict[int, float]] = {}
    duplicates: dict[str, int] = {}
    invalid_rows: dict[str, int] = {}
    invalid_frequency: dict[str, int] = {}
    parsed_rows: dict[str, int] = {}

    date_index, time_index, freq_index = columns
    for row in rows[start_index:]:
        if not row or len(row) <= max(columns):
            continue
        local_date = normalize_date(row[date_index])
        second = time_to_second(row[time_index])
        frequency = parse_frequency(row[freq_index])
        if not local_date:
            continue
        parsed_rows[local_date] = parsed_rows.get(local_date, 0) + 1
        if second < 0:
            invalid_rows[local_date] = invalid_rows.get(local_date, 0) + 1
            continue
        if not (49.0 <= frequency <= 51.0):
            invalid_frequency[local_date] = invalid_frequency.get(local_date, 0) + 1
            continue
        day = by_day.setdefault(local_date, {})
        if second in day:
            duplicates[local_date] = duplicates.get(local_date, 0) + 1
        day[second] = frequency

    packages = {}
    digest = sha256_bytes(data)
    download_time = downloaded_at_utc or utc_now_iso()
    for local_date, samples in by_day.items():
        local_day = datetime.strptime(local_date, "%Y-%m-%d").date()
        packages[local_date] = build_day_package(
            source="netztransparenz",
            local_date=local_day,
            timezone_name=NETZTRANSPARENZ_TIMEZONE,
            samples_by_second=samples,
            source_url=source_url,
            sha256=digest,
            downloaded_at_utc=download_time,
            http_status=0,
            source_size=len(data),
            duplicate_samples=duplicates.get(local_date, 0),
            parsed_rows=parsed_rows.get(local_date, 0),
            invalid_rows=invalid_rows.get(local_date, 0),
            invalid_frequency_samples=invalid_frequency.get(local_date, 0),
        )
    return packages


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a monthly Netztransparenz frequency CSV.")
    parser.add_argument("--input", required=True, help="Path to the monthly CSV file.")
    parser.add_argument("--output-root", default="data/netztransparenz/2026")
    args = parser.parse_args()

    input_path = Path(args.input)
    packages = parse_netztransparenz_csv(input_path.read_bytes(), source_url=str(input_path))
    root = Path(args.output_root)
    for package in packages.values():
        month = package.local_date[5:7]
        stem = package.local_date.replace("-", "")
        day_root = root / month
        from scripts.normalize_frequency import write_frequency_i16

        write_frequency_i16(day_root / f"{stem}.frequency.i16", package.encoded)
        write_json(day_root / f"{stem}.minute.json", package.minute)
        write_json(day_root / f"{stem}.hourly.json", package.hourly)
        write_json(day_root / f"{stem}.meta.json", package.meta)
    data_root = root.parents[1] if len(root.parents) >= 2 else Path("data")
    build_manifest(data_root)
    print(f"Imported {len(packages)} Netztransparenz day(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
