from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import math
import re
import statistics
import sys
import time
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time as dt_time, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote

import requests

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.import_netztransparenz import local_second_to_day_index
from scripts.netztransparenz_client import NetztransparenzApiError, authorized_request
from scripts.normalize_frequency import (
    ACTIVE_STATUSES,
    NETZTRANSPARENZ_TIMEZONE,
    build_day_package,
    build_hourly_rows,
    build_manifest,
    build_minute_rows,
    expected_seconds_for_local_day,
    parse_frequency,
    sha256_bytes,
    time_to_second,
    utc_now_iso,
    write_day_outputs,
)

CONFIG_PATH = Path("config/netztransparenz.json")
SOURCE = "netztransparenz"
USER_AGENT = "zfrekans-rapor-data-bot/1.0"
FREQUENCY_PRODUCT_ID = 35
FREQUENCY_TITLE = "Sekuendliche Frequenz"
FREQUENCY_UNIT = "Hz"
MW_PRODUCT_ID = 33


@dataclass
class NormalizedFrequencySeries:
    samples_by_day: dict[str, dict[int, float]]
    expected_samples_by_day: dict[str, int]
    raw_record_count: int
    normalized_record_count: int
    forward_filled_seconds: int
    largest_gap_seconds: int
    gaps_over_four_seconds: int
    duplicate_samples: int
    invalid_rows: int
    invalid_frequency_samples: int
    first_timestamp_utc: str | None
    last_timestamp_utc: str | None
    raw_record_count_by_day: dict[str, int] = field(default_factory=dict)
    duplicate_samples_by_day: dict[str, int] = field(default_factory=dict)
    invalid_rows_by_day: dict[str, int] = field(default_factory=dict)
    invalid_frequency_samples_by_day: dict[str, int] = field(default_factory=dict)
    forward_filled_by_day: dict[str, int] = field(default_factory=dict)
    largest_gap_by_day: dict[str, int] = field(default_factory=dict)
    gaps_over_four_by_day: dict[str, int] = field(default_factory=dict)
    first_timestamp_utc_by_day: dict[str, str | None] = field(default_factory=dict)
    last_timestamp_utc_by_day: dict[str, str | None] = field(default_factory=dict)


class HiddenInputParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.inputs: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "input":
            self.inputs.append({key: value or "" for key, value in attrs})


def parse_iso_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def date_range(start: date, end: date) -> list[date]:
    if end < start:
        return []
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def source_day_paths(data_root: Path, local_date: str) -> dict[str, Path]:
    stem = local_date.replace("-", "")
    return {
        "frequency": data_root / SOURCE / local_date[:4] / local_date[5:7] / f"{stem}.frequency.i16",
        "meta": data_root / SOURCE / local_date[:4] / local_date[5:7] / f"{stem}.meta.json",
    }


def read_existing_meta(data_root: Path, local_date: str) -> dict[str, Any] | None:
    path = source_day_paths(data_root, local_date)["meta"]
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def is_existing_valid(data_root: Path, local_date: str) -> bool:
    paths = source_day_paths(data_root, local_date)
    meta = read_existing_meta(data_root, local_date)
    if not meta or not paths["frequency"].exists():
        return False
    return meta.get("status") in ACTIVE_STATUSES and bool(meta.get("sha256"))


def find_missing_dates(
    start: date,
    end: date,
    *,
    data_root: str | Path = "data",
    publication_lag_days: int = 4,
    today: date | None = None,
) -> dict[str, list[str] | str | None]:
    root = Path(data_root)
    current_day = today or datetime.now(UTC).date()
    latest_published = current_day - timedelta(days=max(0, publication_lag_days))
    missing: list[str] = []
    existing_valid: list[str] = []
    invalid: list[str] = []
    not_yet_published: list[str] = []

    for day in date_range(start, min(end, current_day)):
        local_date = day.isoformat()
        if day > latest_published:
            not_yet_published.append(local_date)
            continue
        meta = read_existing_meta(root, local_date)
        if is_existing_valid(root, local_date):
            existing_valid.append(local_date)
            continue
        if meta:
            invalid.append(local_date)
        missing.append(local_date)

    return {
        "missingDates": missing,
        "existingValidDates": existing_valid,
        "invalidDates": invalid,
        "notYetPublishedDates": not_yet_published,
        "latestPublishedDate": latest_published.isoformat() if latest_published <= current_day else None,
    }


def discover_frequency_endpoint(config: dict[str, Any] | None = None, *, session: requests.Session | None = None) -> dict[str, Any]:
    resolved = config or load_config()
    swagger = resolved.get("swagger")
    rejected: list[str] = []
    if swagger is None and resolved.get("swaggerUrl"):
        http = session or requests.Session()
        response = http.get(resolved["swaggerUrl"], timeout=30, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()
        swagger = response.json()

    endpoint_found = False
    frequency_data = ""
    frequency_product = ""
    if isinstance(swagger, dict):
        for path, spec in swagger.get("paths", {}).items():
            haystack = json.dumps(spec, ensure_ascii=False).lower() + " " + str(path).lower()
            if "nrvsaldo" in haystack:
                rejected.append("NRVSaldo")
            if "frequency" in haystack or "frequenz" in haystack:
                if "hz" in haystack and "mw" not in haystack:
                    endpoint_found = True
                    parts = [part for part in str(path).split("/") if part and "{" not in part]
                    if len(parts) >= 4:
                        frequency_data = parts[-2]
                        frequency_product = parts[-1]
    if not endpoint_found:
        frequency_data = ""
        frequency_product = ""

    return {
        "endpointFound": endpoint_found,
        "frequencyData": frequency_data,
        "frequencyProduct": frequency_product,
        "rejectedCandidates": sorted(set(rejected)),
    }


def official_settings(config: dict[str, Any] | None = None) -> dict[str, Any]:
    official = (config or load_config()).get("officialDownload", {})
    return {
        "DataType": int(official.get("dataType", 20)),
        "ProduktId": int(official.get("productId", FREQUENCY_PRODUCT_ID)),
        "CultureName": "en-US",
        "Title": official.get("title", FREQUENCY_TITLE),
        "DiagramType": None,
        "TimeInterval": int(official.get("timeInterval", 15)),
        "DataUnit": official.get("dataUnit", FREQUENCY_UNIT),
        "CsvColumns": official.get("csvColumns", ["50Hertz", "Amprion", "TenneT TSO", "TransnetBW"]),
        "TsoIds": official.get("tsoIds", [0]),
        "NrvDirection": int(official.get("nrvDirection", 0)),
        "WebApiRoute": None,
        "WebApiBaseUri": None,
    }


def build_official_csv_request(
    local_from: date,
    local_to_exclusive: date,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resolved = config or load_config()
    official = resolved.get("officialDownload", {})
    payload = {
        "LocalFrom": local_from.isoformat(),
        "LocalTo": local_to_exclusive.isoformat(),
        "ResultTimeZone": official.get("resultTimezone", "cet"),
        "Settings": official_settings(resolved),
    }
    encoded = base64.b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("ascii")
    base_url = official.get(
        "csvDownloadUrl",
        "https://www.netztransparenz.de/DesktopModules/LotesCharts/CsvDownloadHandler.ashx",
    )
    return {"url": f"{base_url}?request={quote(encoded)}", "payload": payload, "encodedRequest": encoded}


def detect_response_format(data: bytes, content_type: str | None = None) -> str:
    if not data:
        return "empty"
    if data[:2] == b"PK":
        return "zip"
    lowered_content_type = (content_type or "").lower()
    sample = data[:4096].lstrip()
    lower_text = sample.decode("utf-8-sig", errors="ignore").lower()
    if lower_text.startswith("<") or "<html" in lower_text or "login" in lower_text:
        return "html"
    if "json" in lowered_content_type or lower_text.startswith("{") or lower_text.startswith("["):
        return "json"
    return "csv"


def sniff_delimiter(sample: str) -> str:
    candidates = [";", ",", "\t"]
    return max(candidates, key=sample.count)


def normalize_header(value: str) -> str:
    return value.strip().lower().replace("\ufeff", "")


def detect_csv_columns(rows: list[list[str]]) -> tuple[int, int, int, int]:
    header_index = -1
    date_index = time_index = freq_index = -1
    for index, row in enumerate(rows[:20]):
        lowered = [normalize_header(cell) for cell in row]
        if any("mw" in cell or "leistung" in cell or "sollwert" in cell for cell in lowered):
            raise ValueError("MW or setpoint product detected instead of Hz frequency")
        date_index = next((i for i, cell in enumerate(lowered) if "date" in cell or "datum" in cell), -1)
        time_index = next((i for i, cell in enumerate(lowered) if "time" in cell or "zeit" in cell), -1)
        freq_index = next(
            (
                i
                for i, cell in enumerate(lowered)
                if "frequency" in cell or "frequenz" in cell or "[hz]" in cell or cell == "hz" or cell == "deutschland"
            ),
            -1,
        )
        if min(date_index, time_index, freq_index) >= 0:
            header_index = index
            break
    if header_index >= 0:
        return header_index, date_index, time_index, freq_index
    if rows and len(rows[0]) >= 3 and normalize_csv_date(rows[0][0]) and normalize_csv_time(rows[0][1]) and math.isfinite(parse_frequency(rows[0][2])):
        return -1, 0, 1, 2
    raise ValueError("Frequency CSV did not contain timestamp and frequency columns")


def parse_json_payload(data: bytes, *, requested_from: str, requested_to: str) -> list[dict[str, Any]]:
    payload = json.loads(data.decode("utf-8-sig"))
    if isinstance(payload, dict) and isinstance(payload.get("d"), str):
        nested = json.loads(payload["d"])
        grid_data = nested.get("gridData")
        if grid_data:
            return parse_frequency_payload(grid_data.encode("utf-8"), requested_from=requested_from, requested_to=requested_to)
    records = payload if isinstance(payload, list) else payload.get("data", []) if isinstance(payload, dict) else []
    parsed: list[dict[str, Any]] = []
    for row in records:
        if not isinstance(row, dict):
            continue
        keys = {str(key).lower(): key for key in row}
        timestamp_key = next((keys[key] for key in keys if "timestamp" in key or "date" in key), None)
        frequency_key = next((keys[key] for key in keys if "frequency" in key or "frequenz" in key or "hz" in key), None)
        if not timestamp_key or not frequency_key:
            continue
        timestamp = str(row[timestamp_key])
        if "T" in timestamp:
            local_date, local_time = timestamp.split("T", 1)
            local_time = local_time[:8]
        else:
            parts = timestamp.split()
            if len(parts) < 2:
                continue
            local_date, local_time = parts[0], parts[1][:8]
        parsed.append({"local_date": local_date, "local_time": local_time, "frequency_hz": parse_frequency(row[frequency_key])})
    return validate_frequency_records(parsed, requested_from=requested_from, requested_to=requested_to)["records"]


def parse_csv_payload(data: bytes, *, requested_from: str, requested_to: str) -> list[dict[str, Any]]:
    text = data.decode("utf-8-sig", errors="replace")
    if not text.strip():
        raise ValueError("Empty frequency CSV")
    lower = text[:4096].lower()
    if "<html" in lower or "login" in lower:
        raise ValueError("HTML/login response is not frequency data")
    delimiter = sniff_delimiter(text[:4096])
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    if not rows:
        raise ValueError("Empty frequency CSV")
    header_index, date_index, time_index, freq_index = detect_csv_columns(rows)
    start_index = header_index + 1 if header_index >= 0 else 0
    parsed: list[dict[str, Any]] = []
    for row in rows[start_index:]:
        if not row or len(row) <= max(date_index, time_index, freq_index):
            continue
        local_date = normalize_csv_date(row[date_index])
        local_time = normalize_csv_time(row[time_index])
        frequency = parse_frequency(row[freq_index])
        if not local_date or not local_time:
            continue
        parsed.append({"local_date": local_date, "local_time": local_time, "frequency_hz": frequency})
    return validate_frequency_records(parsed, requested_from=requested_from, requested_to=requested_to)["records"]


def normalize_csv_date(raw: Any) -> str:
    text = str(raw or "").strip()
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def normalize_csv_time(raw: Any) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if "." in text and ":" in text:
        text = text.split(".", 1)[0]
    parts = text.split(":")
    if len(parts) < 3:
        return ""
    try:
        hour = int(parts[0])
        minute = int(parts[1])
        second = int(float(parts[2]))
    except ValueError:
        return ""
    if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
        return ""
    return f"{hour:02d}:{minute:02d}:{second:02d}"


def parse_frequency_payload(data: bytes, *, requested_from: str, requested_to: str, content_type: str | None = None) -> list[dict[str, Any]]:
    response_format = detect_response_format(data, content_type)
    if response_format == "empty":
        raise ValueError("Empty frequency response")
    if response_format == "html":
        raise ValueError("HTML/login response is not frequency data")
    if response_format == "zip":
        records: list[dict[str, Any]] = []
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = [name for name in archive.namelist() if name.lower().endswith((".csv", ".txt"))]
            if not names:
                raise ValueError("Frequency ZIP did not contain a CSV/TXT file")
            for name in names:
                records.extend(
                    parse_frequency_payload(
                        archive.read(name),
                        requested_from=requested_from,
                        requested_to=requested_to,
                    )
                )
        return validate_frequency_records(records, requested_from=requested_from, requested_to=requested_to)["records"]
    if response_format == "json":
        return parse_json_payload(data, requested_from=requested_from, requested_to=requested_to)
    return parse_csv_payload(data, requested_from=requested_from, requested_to=requested_to)


def validate_frequency_records(records: list[dict[str, Any]], *, requested_from: str, requested_to: str) -> dict[str, Any]:
    if not records:
        raise ValueError("No frequency records found")
    request_start = parse_iso_date(requested_from)
    request_end = parse_iso_date(requested_to)
    values = [float(record["frequency_hz"]) for record in records if math.isfinite(float(record.get("frequency_hz", math.nan)))]
    if not values:
        raise ValueError("No numeric frequency values found")
    hz_ratio = sum(1 for value in values if 45 <= value <= 55) / len(values)
    if hz_ratio < 0.9:
        raise ValueError("Most values are outside the 45-55 Hz frequency range")
    median = statistics.median(values)
    if not (49 <= median <= 51):
        raise ValueError("Median is not near 50 Hz; wrong product suspected")
    seen: set[tuple[str, str]] = set()
    duplicates = 0
    dates: list[date] = []
    clean: list[dict[str, Any]] = []
    for record in records:
        local_date = str(record.get("local_date", ""))
        local_time = str(record.get("local_time", ""))
        frequency = float(record.get("frequency_hz", math.nan))
        if not local_date or not local_time:
            continue
        if not (45 <= frequency <= 55):
            continue
        key = (local_date, local_time)
        if key in seen:
            duplicates += 1
        seen.add(key)
        try:
            dates.append(parse_iso_date(local_date))
        except ValueError:
            continue
        clean.append({"local_date": local_date, "local_time": local_time, "frequency_hz": frequency})
    if not clean:
        raise ValueError("No valid frequency records remained after validation")
    if duplicates and duplicates / max(1, len(clean)) > 0.2:
        raise ValueError("duplicate timestamp ratio is too high")
    if not any(request_start <= day <= request_end for day in dates):
        raise ValueError("Frequency records do not overlap requested date range")
    return {"records": clean, "duplicateCount": duplicates, "confidence": "high"}


def utc_iso_for_day_index(local_date: str, index: int, timezone_name: str) -> str:
    timezone_start = datetime.combine(parse_iso_date(local_date), dt_time.min, tzinfo=UTC)
    local_day = parse_iso_date(local_date)
    from zoneinfo import ZoneInfo

    start_utc = datetime.combine(local_day, dt_time.min, tzinfo=ZoneInfo(timezone_name)).astimezone(UTC)
    return (start_utc + timedelta(seconds=index)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_local_timestamps(
    records: list[dict[str, Any]],
    *,
    source_timezone: str = NETZTRANSPARENZ_TIMEZONE,
) -> NormalizedFrequencySeries:
    samples_by_day: dict[str, dict[int, float]] = {}
    raw_counts: dict[str, int] = {}
    duplicate_by_day: dict[str, int] = {}
    invalid_rows_by_day: dict[str, int] = {}
    invalid_frequency_by_day: dict[str, int] = {}
    first_by_day: dict[str, str | None] = {}
    last_by_day: dict[str, str | None] = {}
    invalid_rows = 0
    invalid_frequency = 0
    duplicates = 0

    for record in sorted(records, key=lambda item: (str(item.get("local_date", "")), str(item.get("local_time", "")))):
        local_date = str(record.get("local_date", ""))
        local_time = str(record.get("local_time", ""))
        frequency = float(record.get("frequency_hz", math.nan))
        if not local_date or not local_time or time_to_second(local_time) < 0:
            invalid_rows += 1
            invalid_rows_by_day[local_date] = invalid_rows_by_day.get(local_date, 0) + 1
            continue
        if not math.isfinite(frequency) or not (45 <= frequency <= 55):
            invalid_frequency += 1
            invalid_frequency_by_day[local_date] = invalid_frequency_by_day.get(local_date, 0) + 1
            continue
        day_samples = samples_by_day.setdefault(local_date, {})
        index, duplicate = local_second_to_day_index(local_date, time_to_second(local_time), source_timezone, day_samples)
        if index is None:
            invalid_rows += 1
            invalid_rows_by_day[local_date] = invalid_rows_by_day.get(local_date, 0) + 1
            continue
        if duplicate:
            duplicates += 1
            duplicate_by_day[local_date] = duplicate_by_day.get(local_date, 0) + 1
            continue
        day_samples[index] = frequency
        raw_counts[local_date] = raw_counts.get(local_date, 0) + 1

    expected_by_day = {
        local_date: expected_seconds_for_local_day(parse_iso_date(local_date), source_timezone)
        for local_date in samples_by_day
    }
    forward_filled = 0
    gaps_over_four = 0
    largest_gap = 0
    forward_by_day: dict[str, int] = {}
    gaps_over_four_by_day: dict[str, int] = {}
    largest_gap_by_day: dict[str, int] = {}

    for local_date, samples in samples_by_day.items():
        indexes = sorted(samples)
        if indexes:
            first_by_day[local_date] = utc_iso_for_day_index(local_date, indexes[0], source_timezone)
            last_by_day[local_date] = utc_iso_for_day_index(local_date, indexes[-1], source_timezone)
        else:
            first_by_day[local_date] = None
            last_by_day[local_date] = None
        for previous, current in zip(indexes, indexes[1:]):
            gap = current - previous
            largest_gap = max(largest_gap, gap)
            largest_gap_by_day[local_date] = max(largest_gap_by_day.get(local_date, 0), gap)
            if 1 < gap <= 4:
                for missing_index in range(previous + 1, current):
                    samples[missing_index] = samples[previous]
                    forward_filled += 1
                    forward_by_day[local_date] = forward_by_day.get(local_date, 0) + 1
            elif gap > 4:
                gaps_over_four += 1
                gaps_over_four_by_day[local_date] = gaps_over_four_by_day.get(local_date, 0) + 1

    normalized_count = sum(len(samples) for samples in samples_by_day.values())
    first_utc = min((value for value in first_by_day.values() if value), default=None)
    last_utc = max((value for value in last_by_day.values() if value), default=None)
    return NormalizedFrequencySeries(
        samples_by_day=samples_by_day,
        expected_samples_by_day=expected_by_day,
        raw_record_count=sum(raw_counts.values()),
        normalized_record_count=normalized_count,
        forward_filled_seconds=forward_filled,
        largest_gap_seconds=largest_gap,
        gaps_over_four_seconds=gaps_over_four,
        duplicate_samples=duplicates,
        invalid_rows=invalid_rows,
        invalid_frequency_samples=invalid_frequency,
        first_timestamp_utc=first_utc,
        last_timestamp_utc=last_utc,
        raw_record_count_by_day=raw_counts,
        duplicate_samples_by_day=duplicate_by_day,
        invalid_rows_by_day=invalid_rows_by_day,
        invalid_frequency_samples_by_day=invalid_frequency_by_day,
        forward_filled_by_day=forward_by_day,
        largest_gap_by_day=largest_gap_by_day,
        gaps_over_four_by_day=gaps_over_four_by_day,
        first_timestamp_utc_by_day=first_by_day,
        last_timestamp_utc_by_day=last_by_day,
    )


def split_into_utc_days(normalized: NormalizedFrequencySeries) -> dict[str, dict[int, float]]:
    return normalized.samples_by_day


def filter_normalized_days(normalized: NormalizedFrequencySeries, allowed_dates: Iterable[str]) -> NormalizedFrequencySeries:
    allowed = set(allowed_dates)
    samples = {day: values for day, values in normalized.samples_by_day.items() if day in allowed}
    return NormalizedFrequencySeries(
        samples_by_day=samples,
        expected_samples_by_day={day: value for day, value in normalized.expected_samples_by_day.items() if day in allowed},
        raw_record_count=sum(normalized.raw_record_count_by_day.get(day, 0) for day in allowed),
        normalized_record_count=sum(len(samples.get(day, {})) for day in allowed),
        forward_filled_seconds=sum(normalized.forward_filled_by_day.get(day, 0) for day in allowed),
        largest_gap_seconds=max((normalized.largest_gap_by_day.get(day, 0) for day in allowed), default=0),
        gaps_over_four_seconds=sum(normalized.gaps_over_four_by_day.get(day, 0) for day in allowed),
        duplicate_samples=sum(normalized.duplicate_samples_by_day.get(day, 0) for day in allowed),
        invalid_rows=sum(normalized.invalid_rows_by_day.get(day, 0) for day in allowed),
        invalid_frequency_samples=sum(normalized.invalid_frequency_samples_by_day.get(day, 0) for day in allowed),
        first_timestamp_utc=min((normalized.first_timestamp_utc_by_day.get(day) for day in allowed if normalized.first_timestamp_utc_by_day.get(day)), default=None),
        last_timestamp_utc=max((normalized.last_timestamp_utc_by_day.get(day) for day in allowed if normalized.last_timestamp_utc_by_day.get(day)), default=None),
        raw_record_count_by_day={day: value for day, value in normalized.raw_record_count_by_day.items() if day in allowed},
        duplicate_samples_by_day={day: value for day, value in normalized.duplicate_samples_by_day.items() if day in allowed},
        invalid_rows_by_day={day: value for day, value in normalized.invalid_rows_by_day.items() if day in allowed},
        invalid_frequency_samples_by_day={day: value for day, value in normalized.invalid_frequency_samples_by_day.items() if day in allowed},
        forward_filled_by_day={day: value for day, value in normalized.forward_filled_by_day.items() if day in allowed},
        largest_gap_by_day={day: value for day, value in normalized.largest_gap_by_day.items() if day in allowed},
        gaps_over_four_by_day={day: value for day, value in normalized.gaps_over_four_by_day.items() if day in allowed},
        first_timestamp_utc_by_day={day: value for day, value in normalized.first_timestamp_utc_by_day.items() if day in allowed},
        last_timestamp_utc_by_day={day: value for day, value in normalized.last_timestamp_utc_by_day.items() if day in allowed},
    )


def write_minute_summary(values: list[float], expected_samples: int) -> list[dict[str, Any]]:
    return build_minute_rows(values, expected_samples)


def write_hourly_summary(values: list[float], expected_samples: int) -> list[dict[str, Any]]:
    return build_hourly_rows(values, expected_samples)


def write_daily_data(
    normalized: NormalizedFrequencySeries,
    *,
    data_root: str | Path = "data",
    source_method: str,
    source_url: str,
    source_sha256: str,
    downloaded_at_utc: str,
    http_status: int,
    source_size: int,
    requested_from: str,
    requested_to: str,
    force: bool = False,
) -> list[dict[str, Any]]:
    root = Path(data_root)
    written: list[dict[str, Any]] = []
    for local_date, samples in sorted(normalized.samples_by_day.items()):
        previous_meta = read_existing_meta(root, local_date)
        if previous_meta and previous_meta.get("status") in ACTIVE_STATUSES and not force:
            written.append({"date": local_date, "status": "unchanged", "reason": "existing_valid", "sourceMethod": previous_meta.get("sourceMethod", "manual")})
            continue
        local_day = parse_iso_date(local_date)
        package = build_day_package(
            source=SOURCE,
            local_date=local_day,
            timezone_name=NETZTRANSPARENZ_TIMEZONE,
            samples_by_second=samples,
            source_url=source_url,
            sha256=source_sha256,
            downloaded_at_utc=downloaded_at_utc,
            http_status=http_status,
            source_size=source_size,
            duplicate_samples=normalized.duplicate_samples_by_day.get(local_date, 0),
            parsed_rows=normalized.raw_record_count_by_day.get(local_date, len(samples)),
            invalid_rows=normalized.invalid_rows_by_day.get(local_date, 0),
            invalid_frequency_samples=normalized.invalid_frequency_samples_by_day.get(local_date, 0),
        )
        expected = package.expected_samples
        coverage = 100 * package.valid_samples / expected if expected else 0
        package.meta.update(
            {
                "date": local_date,
                "sourceMethod": source_method,
                "sourceTimezone": NETZTRANSPARENZ_TIMEZONE,
                "normalizedTimezone": "UTC",
                "requestedFrom": requested_from,
                "requestedTo": requested_to,
                "recordCount": package.valid_samples,
                "rawRecordCount": normalized.raw_record_count_by_day.get(local_date, package.parsed_rows),
                "normalizedRecordCount": len(samples),
                "coveragePercent": round(coverage, 6),
                "firstTimestampUtc": normalized.first_timestamp_utc_by_day.get(local_date),
                "lastTimestampUtc": normalized.last_timestamp_utc_by_day.get(local_date),
                "largestGapSeconds": normalized.largest_gap_by_day.get(local_date, 0),
                "gapsOverFourSeconds": normalized.gaps_over_four_by_day.get(local_date, 0),
                "forwardFilledSeconds": normalized.forward_filled_by_day.get(local_date, 0),
            }
        )
        write_day_outputs(package, root)
        written.append(
            {
                "date": local_date,
                "status": package.status,
                "sourceMethod": source_method,
                "rawRecordCount": package.meta["rawRecordCount"],
                "normalizedRecordCount": package.meta["normalizedRecordCount"],
                "coveragePercent": package.meta["coveragePercent"],
                "largestGapSeconds": package.meta["largestGapSeconds"],
                "gapsOverFourSeconds": package.meta["gapsOverFourSeconds"],
                "forwardFilledSeconds": package.meta["forwardFilledSeconds"],
                "sha256": source_sha256,
                "qualityScore": package.quality_score,
            }
        )
    return written


def update_manifest(data_root: str | Path = "data") -> dict[str, Any]:
    return build_manifest(data_root)


def parse_official_inventory(data: bytes) -> list[dict[str, Any]]:
    text = data.decode("utf-8-sig", errors="replace")
    rows = list(csv.reader(io.StringIO(text), delimiter=";"))
    if len(rows) < 2:
        return []
    header = [normalize_header(cell) for cell in rows[0]]
    files: list[dict[str, Any]] = []
    for row in rows[1:]:
        if len(row) < 5:
            continue
        filename = row[0].strip()
        title = row[1].strip()
        file_id = row[-1].strip()
        match = re.search(r"Frequenz_(\d{8})_(\d{8})\.csv\.zip", filename, flags=re.IGNORECASE)
        if not match or title != FREQUENCY_TITLE or not file_id:
            continue
        start = datetime.strptime(match.group(1), "%Y%m%d").date()
        end = datetime.strptime(match.group(2), "%Y%m%d").date()
        files.append({"filename": filename, "title": title, "fileId": file_id, "start": start, "end": end, "period": row[3].strip()})
    return files


def discover_official_frequency_files(
    local_from: date,
    local_to: date,
    *,
    config: dict[str, Any] | None = None,
    session: requests.Session | None = None,
) -> dict[str, Any]:
    resolved = config or load_config()
    http = session or requests.Session()
    request = build_official_csv_request(local_from, local_to + timedelta(days=1), resolved)
    response = http.get(request["url"], timeout=60, headers={"User-Agent": USER_AGENT})
    if response.status_code != 200:
        raise NetztransparenzApiError(
            f"Official inventory download failed with HTTP {response.status_code}",
            category="download_failed",
            http_status=response.status_code,
            step="official_inventory",
        )
    if detect_response_format(response.content, response.headers.get("content-type")) != "csv":
        raise ValueError("Official inventory response was not CSV")
    files = parse_official_inventory(response.content)
    selected = [
        item
        for item in files
        if item["start"] <= local_to and item["end"] >= local_from and (item["start"].month == local_from.month or item["period"].count("/") == 1)
    ]
    month_selected = [item for item in selected if item["start"].month == local_from.month and item["start"].year == local_from.year]
    if month_selected:
        selected = month_selected
    if not selected:
        raise FileNotFoundError(f"No official frequency file listed for {local_from}..{local_to}")
    latest = max(item["end"] for item in selected)
    return {"files": selected, "latestPublishedDate": latest.isoformat(), "inventoryUrl": request["url"]}


def postback_download_file(file_info: dict[str, Any], *, config: dict[str, Any], session: requests.Session) -> bytes:
    official = config.get("officialDownload", {})
    page_url = official.get("pageUrl")
    module_id = official.get("moduleId", "dnn_ctr3323_View")
    event_target = official.get("eventTarget", "dnn$ctr3323$View$btnHiddenNrvSecondlyValueFileDownload")
    page_response = session.get(page_url, timeout=60, headers={"User-Agent": USER_AGENT})
    page_response.raise_for_status()
    parser = HiddenInputParser()
    parser.feed(page_response.text)
    form_data: dict[str, str] = {}
    for input_tag in parser.inputs:
        name = input_tag.get("name")
        input_type = input_tag.get("type", "").lower()
        if name and input_type not in {"button", "submit", "image", "file"}:
            form_data[name] = input_tag.get("value", "")
    form_data["__EVENTTARGET"] = event_target
    form_data["__EVENTARGUMENT"] = ""
    form_data[f"{module_id.replace('_', '$')}$hFNrvSecondlyValueDownloadFileId"] = file_info["fileId"]
    form_data[f"{module_id.replace('_', '$')}$hFNrvSecondlyValueDownloadFileName"] = file_info["filename"]
    headers = {
        "User-Agent": USER_AGENT,
        "Referer": page_url,
        "Origin": "https://www.netztransparenz.de",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    response = session.post(page_url, data=form_data, headers=headers, timeout=180)
    if response.status_code != 200:
        raise NetztransparenzApiError(
            f"Official ZIP postback failed with HTTP {response.status_code}",
            category="download_failed",
            http_status=response.status_code,
            step="official_zip_download",
        )
    if not response.content.startswith(b"PK"):
        raise ValueError("Official download did not return a ZIP file")
    return response.content


def download_official_zip(
    local_from: date,
    local_to: date,
    *,
    config: dict[str, Any] | None = None,
    session: requests.Session | None = None,
) -> dict[str, Any]:
    resolved = config or load_config()
    http = session or requests.Session()
    http.headers.update({"User-Agent": USER_AGENT})
    discovery = discover_official_frequency_files(local_from, local_to, config=resolved, session=http)
    file_info = sorted(discovery["files"], key=lambda item: (item["start"], item["end"]))[0]
    data = postback_download_file(file_info, config=resolved, session=http)
    return {
        "data": data,
        "sourceUrl": f"official-postback:{file_info['filename']}",
        "httpStatus": 200,
        "sourceSize": len(data),
        "latestPublishedDate": discovery["latestPublishedDate"],
        "file": file_info,
    }


def download_api_range(
    local_from: date,
    local_to: date,
    *,
    config: dict[str, Any] | None = None,
    session: requests.Session | None = None,
) -> dict[str, Any]:
    resolved = config or load_config()
    discovery = discover_frequency_endpoint(resolved, session=session)
    if not discovery.get("endpointFound"):
        raise NetztransparenzApiError(
            "No verified Netztransparenz frequency Web API endpoint is configured",
            category="endpoint_not_found",
            step="api_discovery",
        )
    api_base = resolved.get("apiBaseUrl", "https://ds.netztransparenz.de/api/v1").rstrip("/")
    url = f"{api_base}/data/{discovery['frequencyData']}/{discovery['frequencyProduct']}/{local_from.isoformat()}/{local_to.isoformat()}"
    response = authorized_request("GET", url, session=session)
    return {
        "data": response.content,
        "sourceUrl": url,
        "httpStatus": response.status_code,
        "sourceSize": len(response.content),
        "latestPublishedDate": local_to.isoformat(),
    }


def update_status(data_root: str | Path, summary: dict[str, Any]) -> None:
    root = Path(data_root)
    path = root / "status.json"
    previous: dict[str, Any] = {}
    if path.exists():
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = {}
    now = summary.get("workflowRunAt") or utc_now_iso()
    processed = summary.get("processed", [])
    successful_dates = [item["date"] for item in processed if item.get("status") not in {"dry_run", "error", "unchanged"}]
    unchanged_dates = [item["date"] for item in processed if item.get("status") == "unchanged"]
    previous_success = previous.get("netztransparenz", {}).get("lastSuccessfulDataDate") or previous.get("lastSuccessfulNetztransparenzDataDate")
    if previous_success:
        successful_dates.append(previous_success)
    latest_success = max(successful_dates + unchanged_dates, default=previous_success)
    status_value = summary.get("status", "success")
    last_error = summary.get("lastError")
    netz = {
        **previous.get("netztransparenz", {}),
        "lastRunAt": now,
        "lastSuccessfulRunAt": now if status_value in {"success", "partial", "not_yet_published"} else previous.get("netztransparenz", {}).get("lastSuccessfulRunAt"),
        "lastFailedRunAt": now if status_value not in {"success", "partial", "not_yet_published"} else previous.get("netztransparenz", {}).get("lastFailedRunAt"),
        "lastSuccessfulDataDate": latest_success,
        "lastAttemptedDataDate": summary.get("requestedTo") or previous.get("netztransparenz", {}).get("lastAttemptedDataDate"),
        "latestPublishedDate": summary.get("latestPublishedDate"),
        "status": status_value,
        "sourceMethod": summary.get("sourceMethod", "official_zip"),
        "missingDates": summary.get("missingDates", []),
        "notYetPublishedDates": summary.get("notYetPublishedDates", []),
        "invalidDates": summary.get("invalidDates", []),
        "lastError": last_error,
    }
    updated = {
        **previous,
        "updatedAtUtc": now,
        "lastSuccessfulNetztransparenzDataDate": latest_success,
        "netztransparenz": netz,
    }
    write_json(path, updated)


def group_dates_by_month(dates: Iterable[str]) -> list[tuple[date, date]]:
    grouped: dict[tuple[int, int], list[date]] = {}
    for value in dates:
        day = parse_iso_date(value)
        grouped.setdefault((day.year, day.month), []).append(day)
    return [(min(days), max(days)) for days in grouped.values()]


def determine_requested_range(args: argparse.Namespace) -> tuple[date, date]:
    today = datetime.now(UTC).date()
    if args.start:
        start = parse_iso_date(args.start)
    else:
        start = today - timedelta(days=max(0, int(args.max_lookback_days) - 1))
    end = parse_iso_date(args.end) if args.end else today
    return start, min(end, today)


def run(args: argparse.Namespace) -> dict[str, Any]:
    data_root = Path(args.output_root)
    config = load_config(Path(args.config))
    requested_start, requested_end = determine_requested_range(args)
    initial_missing = find_missing_dates(
        requested_start,
        requested_end,
        data_root=data_root,
        publication_lag_days=args.publication_lag_days,
    )
    summary: dict[str, Any] = {
        "status": "success",
        "sourceMethod": "official_zip",
        "processed": [],
        "missingDates": list(initial_missing["missingDates"]),
        "existingValidDates": list(initial_missing["existingValidDates"]),
        "invalidDates": list(initial_missing["invalidDates"]),
        "notYetPublishedDates": list(initial_missing["notYetPublishedDates"]),
        "requestedFrom": requested_start.isoformat(),
        "requestedTo": requested_end.isoformat(),
        "latestPublishedDate": initial_missing.get("latestPublishedDate"),
        "workflowRunAt": utc_now_iso(),
        "rawRecordCount": 0,
        "normalizedRecordCount": 0,
        "largestGapSeconds": 0,
    }

    if args.dry_run:
        summary["status"] = "success"
        return summary

    dates_to_attempt = [day.isoformat() for day in date_range(requested_start, requested_end)]
    if args.fill_missing:
        candidate_dates = set(summary["missingDates"])
    else:
        candidate_dates = set(dates_to_attempt)

    try:
        for segment_start, segment_end in group_dates_by_month(dates_to_attempt):
            if args.source == "api":
                source = download_api_range(segment_start, segment_end, config=config)
                source_method = "api"
            else:
                if args.source == "auto":
                    discovery = discover_frequency_endpoint(config)
                    if discovery.get("endpointFound"):
                        source = download_api_range(segment_start, segment_end, config=config)
                        source_method = "api"
                    else:
                        source = download_official_zip(segment_start, segment_end, config=config)
                        source_method = "official_zip"
                else:
                    source = download_official_zip(segment_start, segment_end, config=config)
                    source_method = "official_zip"

            records = parse_frequency_payload(
                source["data"],
                requested_from=segment_start.isoformat(),
                requested_to=segment_end.isoformat(),
                content_type=source.get("contentType"),
            )
            normalized = normalize_local_timestamps(records)
            latest_source_date = parse_iso_date(str(source.get("latestPublishedDate", segment_end.isoformat())))
            source_available_dates = {
                day
                for day in normalized.samples_by_day
                if requested_start <= parse_iso_date(day) <= min(requested_end, latest_source_date)
            }
            if args.fill_missing and candidate_dates:
                source_available_dates = {
                    day
                    for day in source_available_dates
                    if day in candidate_dates or not is_existing_valid(data_root, day) or args.force
                }
            if not args.force:
                source_available_dates = {day for day in source_available_dates if not is_existing_valid(data_root, day)}
            filtered = filter_normalized_days(normalized, source_available_dates)
            written = write_daily_data(
                filtered,
                data_root=data_root,
                source_method=source_method,
                source_url=source["sourceUrl"],
                source_sha256=sha256_bytes(source["data"]),
                downloaded_at_utc=summary["workflowRunAt"],
                http_status=source["httpStatus"],
                source_size=source["sourceSize"],
                requested_from=segment_start.isoformat(),
                requested_to=segment_end.isoformat(),
                force=args.force,
            )
            summary["processed"].extend(written)
            summary["sourceMethod"] = source_method
            summary["latestPublishedDate"] = max(str(summary.get("latestPublishedDate") or ""), source.get("latestPublishedDate", ""))
            summary["rawRecordCount"] += filtered.raw_record_count
            summary["normalizedRecordCount"] += filtered.normalized_record_count
            summary["largestGapSeconds"] = max(summary["largestGapSeconds"], filtered.largest_gap_seconds)
            if not args.force:
                time.sleep(float(args.request_delay))

        update_manifest(data_root)
        processed_dates = {item["date"] for item in summary["processed"] if item.get("status") != "unchanged"}
        latest_published = parse_iso_date(summary["latestPublishedDate"]) if summary.get("latestPublishedDate") else requested_end
        summary["notYetPublishedDates"] = [
            day.isoformat()
            for day in date_range(min(requested_end, latest_published) + timedelta(days=1), requested_end)
        ]
        summary["missingDates"] = [
            day
            for day in dates_to_attempt
            if day not in processed_dates and not is_existing_valid(data_root, day) and parse_iso_date(day) <= latest_published
        ]
        if summary["missingDates"] and summary["processed"]:
            summary["status"] = "partial"
        elif summary["missingDates"]:
            summary["status"] = "failed"
        elif summary["notYetPublishedDates"] and not summary["processed"]:
            summary["status"] = "not_yet_published"
        else:
            summary["status"] = "success"
        update_status(data_root, summary)
        return summary
    except Exception as error:  # noqa: BLE001 - CLI records safe status before failing
        category = getattr(error, "category", "download_failed")
        http_status = getattr(error, "http_status", None)
        step = getattr(error, "step", "fetch_netztransparenz")
        summary["status"] = category if category in {
            "authentication_failed",
            "authorization_failed",
            "endpoint_not_found",
            "download_failed",
            "parser_failed",
            "validation_failed",
            "not_yet_published",
        } else "failed"
        summary["lastError"] = {
            "step": step,
            "category": category,
            "message": str(error),
            "httpStatus": http_status,
        }
        update_status(data_root, summary)
        raise


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch and normalize Netztransparenz second-resolution frequency data.")
    parser.add_argument("--from", dest="start")
    parser.add_argument("--to", dest="end")
    parser.add_argument("--fill-missing", dest="fill_missing", action="store_true", default=True)
    parser.add_argument("--no-fill-missing", dest="fill_missing", action="store_false")
    parser.add_argument("--source", choices=("auto", "api", "zip"), default="auto")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--max-lookback-days", type=int, default=30)
    parser.add_argument("--publication-lag-days", type=int, default=4)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--output-root", default="data")
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument("--request-delay", default="1")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    summary = run(args)
    print(json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
