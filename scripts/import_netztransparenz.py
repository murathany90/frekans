from __future__ import annotations

import argparse
import csv
import io
import json
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.normalize_frequency import (
    NETZTRANSPARENZ_TIMEZONE,
    build_manifest,
    build_day_package,
    expected_seconds_for_local_day,
    local_day_start_utc,
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


def local_second_to_day_index(
    local_date: str,
    second: int,
    timezone_name: str,
    used_indexes: dict[int, float],
) -> tuple[int | None, bool]:
    if second < 0 or second >= 86400:
        return None, False
    local_day = datetime.strptime(local_date, "%Y-%m-%d").date()
    expected = expected_seconds_for_local_day(local_day, timezone_name)
    if expected == 86400:
        return second, second in used_indexes

    timezone = ZoneInfo(timezone_name)
    start_utc = datetime.combine(local_day, time.min, tzinfo=timezone).astimezone(UTC)
    naive_local = datetime.combine(local_day, time.min) + timedelta(seconds=second)

    candidates: list[int] = []
    for fold in (0, 1):
        aware_local = naive_local.replace(tzinfo=timezone, fold=fold)
        back_to_local = aware_local.astimezone(UTC).astimezone(timezone).replace(tzinfo=None)
        if back_to_local != naive_local:
            continue
        index = int((aware_local.astimezone(UTC) - start_utc).total_seconds())
        if 0 <= index < expected and index not in candidates:
            candidates.append(index)

    if not candidates:
        return None, False
    for index in candidates:
        if index not in used_indexes:
            return index, False
    return candidates[0], True


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
        index, duplicate = local_second_to_day_index(
            local_date,
            second,
            NETZTRANSPARENZ_TIMEZONE,
            day,
        )
        if index is None:
            invalid_rows[local_date] = invalid_rows.get(local_date, 0) + 1
            continue
        if duplicate:
            duplicates[local_date] = duplicates.get(local_date, 0) + 1
        day[index] = frequency

    packages = {}
    digest = sha256_bytes(data)
    download_time = downloaded_at_utc or utc_now_iso()
    for local_date, samples in by_day.items():
        local_day = datetime.strptime(local_date, "%Y-%m-%d").date()
        package = build_day_package(
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
        start_utc = datetime.fromisoformat(local_day_start_utc(local_day, NETZTRANSPARENZ_TIMEZONE).replace("Z", "+00:00"))
        expected = package.expected_samples
        package.meta.update(
            {
                "date": local_date,
                "sourceMethod": "manual",
                "sourceTimezone": NETZTRANSPARENZ_TIMEZONE,
                "normalizedTimezone": "UTC",
                "requestedFrom": min(by_day),
                "requestedTo": max(by_day),
                "recordCount": package.valid_samples,
                "rawRecordCount": parsed_rows.get(local_date, 0),
                "normalizedRecordCount": package.valid_samples,
                "coveragePercent": round(100 * package.valid_samples / expected, 6) if expected else 0,
                "firstTimestampUtc": start_utc.isoformat().replace("+00:00", "Z") if package.valid_samples else None,
                "lastTimestampUtc": (start_utc + timedelta(seconds=max(0, expected - 1))).isoformat().replace("+00:00", "Z") if package.valid_samples else None,
                "largestGapSeconds": 1 if package.valid_samples else 0,
                "gapsOverFourSeconds": 0,
                "forwardFilledSeconds": 0,
            }
        )
        packages[local_date] = package
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
    packages = parse_netztransparenz_csv(input_path.read_bytes(), source_url=f"manual-import:{input_path.name}")
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
