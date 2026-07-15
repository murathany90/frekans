from __future__ import annotations

import csv
import hashlib
import json
import math
from array import array
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from statistics import pstdev
from typing import Iterable
from zoneinfo import ZoneInfo

MISSING_SENTINEL = -32768
ENCODING_BASE_HZ = 50.0
ENCODING_SCALE = 10000
TEIAS_TIMEZONE = "Europe/Istanbul"
NETZTRANSPARENZ_TIMEZONE = "Europe/Berlin"
SOURCE_LABELS = {
    "teias": "TEİAŞ",
    "netztransparenz": "Netztransparenz",
}
ACTIVE_STATUSES = {"complete", "partial", "critical"}


@dataclass
class DayPackage:
    source: str
    local_date: str
    timezone: str
    source_url: str
    downloaded_at_utc: str
    http_status: int
    source_size: int
    sha256: str
    parsed_rows: int
    valid_samples: int
    expected_samples: int
    missing_samples: int
    duplicate_samples: int
    invalid_rows: int
    invalid_frequency_samples: int
    minimum_hz: float
    maximum_hz: float
    average_hz: float
    quality_score: int
    status: str
    encoded: array
    minute: list[dict]
    hourly: list[dict]
    meta: dict


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_frequency(raw: object) -> float:
    if raw is None:
        return math.nan
    text = str(raw).strip().replace("\ufeff", "").replace(" ", "")
    if not text:
        return math.nan
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return math.nan


def normalize_date(raw: object) -> str:
    text = str(raw or "").strip()
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    return ""


def time_to_second(raw: object) -> int:
    text = str(raw or "").strip()
    try:
        parts = text.split(":")
        if len(parts) < 3:
            return -1
        hour, minute, second = (int(parts[0]), int(parts[1]), int(float(parts[2])))
    except ValueError:
        return -1
    if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
        return -1
    return hour * 3600 + minute * 60 + second


def expected_seconds_for_local_day(local_day: date, timezone_name: str) -> int:
    tz = ZoneInfo(timezone_name)
    start = datetime.combine(local_day, time.min, tzinfo=tz)
    end = datetime.combine(local_day + timedelta(days=1), time.min, tzinfo=tz)
    return int((end.astimezone(UTC) - start.astimezone(UTC)).total_seconds())


def local_day_start_utc(local_day: date, timezone_name: str) -> str:
    tz = ZoneInfo(timezone_name)
    start = datetime.combine(local_day, time.min, tzinfo=tz)
    return start.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def local_to_utc_iso(local_date: str, local_time: str, timezone_name: str) -> str:
    day = datetime.strptime(local_date, "%Y-%m-%d").date()
    second = time_to_second(local_time)
    if second < 0:
        raise ValueError(f"Invalid local time: {local_time}")
    tz = ZoneInfo(timezone_name)
    local_dt = datetime.combine(day, time.min, tzinfo=tz) + timedelta(seconds=second)
    return local_dt.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def encode_frequency_array(values: Iterable[float | None]) -> array:
    encoded = array("h")
    for value in values:
        if value is None or not math.isfinite(float(value)):
            encoded.append(MISSING_SENTINEL)
            continue
        raw = int(round((float(value) - ENCODING_BASE_HZ) * ENCODING_SCALE))
        if raw == MISSING_SENTINEL or raw < -32767 or raw > 32767:
            raise ValueError(f"Frequency value out of int16 encoding range: {value}")
        encoded.append(raw)
    return encoded


def decode_frequency_array(values: Iterable[int]) -> list[float | None]:
    decoded: list[float | None] = []
    for value in values:
        if int(value) == MISSING_SENTINEL:
            decoded.append(None)
        else:
            decoded.append(ENCODING_BASE_HZ + int(value) / ENCODING_SCALE)
    return decoded


def encoded_to_floats(values: Iterable[int]) -> list[float]:
    return [math.nan if int(v) == MISSING_SENTINEL else ENCODING_BASE_HZ + int(v) / ENCODING_SCALE for v in values]


def read_frequency_i16(path: Path) -> array:
    data = array("h")
    with path.open("rb") as handle:
        data.frombytes(handle.read())
    return data


def write_frequency_i16(path: Path, encoded: array) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        handle.write(encoded.tobytes())


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def stats_for_values(values: list[float]) -> dict:
    clean = [v for v in values if math.isfinite(v)]
    if not clean:
        return {
            "validSamples": 0,
            "averageHz": None,
            "minimumHz": None,
            "maximumHz": None,
            "standardDeviationHz": None,
            "meanAbsoluteDeviationFrom50Mhz": None,
        }
    return {
        "validSamples": len(clean),
        "averageHz": sum(clean) / len(clean),
        "minimumHz": min(clean),
        "maximumHz": max(clean),
        "standardDeviationHz": pstdev(clean) if len(clean) > 1 else 0.0,
        "meanAbsoluteDeviationFrom50Mhz": sum(abs(v - ENCODING_BASE_HZ) * 1000 for v in clean) / len(clean),
    }


def build_minute_rows(values: list[float], expected_samples: int) -> list[dict]:
    rows: list[dict] = []
    minute_count = math.ceil(expected_samples / 60)
    for minute_index in range(minute_count):
        start = minute_index * 60
        end = min(expected_samples, start + 60)
        stats = stats_for_values(values[start:end])
        rows.append(
            {
                "minute": minute_index,
                "averageHz": stats["averageHz"],
                "minimumHz": stats["minimumHz"],
                "maximumHz": stats["maximumHz"],
                "validSamples": stats["validSamples"],
            }
        )
    return rows


def build_hourly_rows(values: list[float], expected_samples: int) -> list[dict]:
    rows: list[dict] = []
    hour_count = math.ceil(expected_samples / 3600)
    for hour_index in range(hour_count):
        start = hour_index * 3600
        end = min(expected_samples, start + 3600)
        stats = stats_for_values(values[start:end])
        rows.append({"hour": hour_index, **stats})
    return rows


def quality_score(expected: int, valid: int, duplicates: int, invalid_rows: int, invalid_frequency: int) -> int:
    if expected <= 0:
        return 0
    missing = max(0, expected - valid)
    penalty = 100 * (missing / expected)
    penalty += min(30, duplicates * 0.02)
    penalty += min(30, invalid_rows * 0.05)
    penalty += min(30, invalid_frequency * 0.2)
    return max(0, min(100, round(100 - penalty)))


def status_for_quality(score: int, valid: int, expected: int) -> str:
    if valid <= 0:
        return "invalid"
    if score >= 95 and valid == expected:
        return "complete"
    if score >= 80:
        return "partial"
    return "critical"


def build_day_package(
    *,
    source: str,
    local_date: date,
    timezone_name: str,
    samples_by_second: dict[int, float],
    source_url: str,
    sha256: str,
    downloaded_at_utc: str,
    http_status: int,
    source_size: int,
    duplicate_samples: int,
    parsed_rows: int,
    invalid_rows: int,
    invalid_frequency_samples: int,
) -> DayPackage:
    expected = expected_seconds_for_local_day(local_date, timezone_name)
    values = [math.nan] * expected
    valid = 0
    for second, frequency in sorted(samples_by_second.items()):
        if 0 <= second < expected and math.isfinite(frequency):
            values[second] = frequency
            valid += 1

    encoded = encode_frequency_array(values)
    finite = [v for v in values if math.isfinite(v)]
    missing = expected - valid
    score = quality_score(expected, valid, duplicate_samples, invalid_rows, invalid_frequency_samples)
    status = status_for_quality(score, valid, expected)
    minimum = min(finite) if finite else math.nan
    maximum = max(finite) if finite else math.nan
    average = sum(finite) / len(finite) if finite else math.nan
    minute = build_minute_rows(values, expected)
    hourly = build_hourly_rows(values, expected)
    start_utc = local_day_start_utc(local_date, timezone_name)
    meta = {
        "source": source,
        "sourceLabel": SOURCE_LABELS.get(source, source),
        "localDate": local_date.isoformat(),
        "timezone": timezone_name,
        "startUtc": start_utc,
        "sampleIntervalSeconds": 1,
        "expectedSamples": expected,
        "validSamples": valid,
        "missingSamples": missing,
        "duplicateSamples": duplicate_samples,
        "invalidRows": invalid_rows,
        "invalidFrequencySamples": invalid_frequency_samples,
        "encoding": {
            "type": "int16-le",
            "baseHz": ENCODING_BASE_HZ,
            "scale": ENCODING_SCALE,
            "missingValue": MISSING_SENTINEL,
        },
        "minimumHz": None if not finite else minimum,
        "maximumHz": None if not finite else maximum,
        "averageHz": None if not finite else average,
        "sha256": sha256,
        "sourceUrl": source_url,
        "downloadedAtUtc": downloaded_at_utc,
        "httpStatus": http_status,
        "sourceSize": source_size,
        "parsedRows": parsed_rows,
        "qualityScore": score,
        "status": status,
    }
    return DayPackage(
        source=source,
        local_date=local_date.isoformat(),
        timezone=timezone_name,
        source_url=source_url,
        downloaded_at_utc=downloaded_at_utc,
        http_status=http_status,
        source_size=source_size,
        sha256=sha256,
        parsed_rows=parsed_rows,
        valid_samples=valid,
        expected_samples=expected,
        missing_samples=missing,
        duplicate_samples=duplicate_samples,
        invalid_rows=invalid_rows,
        invalid_frequency_samples=invalid_frequency_samples,
        minimum_hz=minimum,
        maximum_hz=maximum,
        average_hz=average,
        quality_score=score,
        status=status,
        encoded=encoded,
        minute=minute,
        hourly=hourly,
        meta=meta,
    )


def split_csv_line(line: str) -> list[str]:
    delimiter = max(("\t", ";", ","), key=line.count)
    return next(csv.reader([line], delimiter=delimiter, quotechar='"'))


def parse_teias_row(cols: list[str], fallback_date: str = "") -> tuple[str, int, float] | None:
    if len(cols) >= 8 and time_to_second(cols[4]) >= 0:
        return normalize_date(cols[7]), time_to_second(cols[4]), parse_frequency(cols[6])
    if any("frekans" in c.lower() or "frequency" in c.lower() for c in cols):
        return None
    time_index = next((i for i, c in enumerate(cols) if time_to_second(c) >= 0), -1)
    date_index = next((i for i, c in enumerate(cols) if normalize_date(c)), -1)
    if time_index < 0:
        return None
    freq_index = -1
    for i, col in enumerate(cols):
        if i in (time_index, date_index):
            continue
        frequency = parse_frequency(col)
        if 45 < frequency < 55:
            freq_index = i
            break
    if freq_index < 0:
        return None
    row_date = normalize_date(cols[date_index]) if date_index >= 0 else fallback_date
    return row_date, time_to_second(cols[time_index]), parse_frequency(cols[freq_index])


def parse_teias_csv(
    data: bytes,
    *,
    source_url: str,
    downloaded_at_utc: str | None = None,
    http_status: int = 200,
    fallback_date: str = "",
) -> DayPackage:
    text = data.decode("utf-8-sig", errors="replace")
    samples: dict[int, float] = {}
    local_date: str | None = None
    parsed_rows = 0
    invalid_rows = 0
    invalid_frequency = 0
    duplicate_samples = 0
    lines = [line for line in text.splitlines() if line.strip()]

    if fallback_date and lines:
        header = lines[0].strip().lower()
        legacy_comma_without_date = "," in lines[0] and ";" not in lines[0] and (
            "frekans" in header or "frequency" in header
        )
        if legacy_comma_without_date:
            local_date = fallback_date
            for raw_line in lines[1:]:
                parsed_rows += 1
                cols = raw_line.split(",")
                if len(cols) < 3:
                    invalid_rows += 1
                    continue
                second = time_to_second(cols[0])
                frequency = parse_frequency(cols[2])
                if second < 0:
                    invalid_rows += 1
                    continue
                if not math.isfinite(frequency) or not (49.0 <= frequency <= 51.0):
                    invalid_frequency += 1
                    continue
                if second in samples:
                    duplicate_samples += 1
                samples[second] = frequency
            return build_day_package(
                source="teias",
                local_date=datetime.strptime(local_date, "%Y-%m-%d").date(),
                timezone_name=TEIAS_TIMEZONE,
                samples_by_second=samples,
                source_url=source_url,
                sha256=sha256_bytes(data),
                downloaded_at_utc=downloaded_at_utc or utc_now_iso(),
                http_status=http_status,
                source_size=len(data),
                duplicate_samples=duplicate_samples,
                parsed_rows=parsed_rows,
                invalid_rows=invalid_rows,
                invalid_frequency_samples=invalid_frequency,
            )

    for raw_line in lines:
        parsed_rows += 1
        if raw_line.lstrip().startswith("<"):
            invalid_rows += 1
            continue
        row = parse_teias_row(split_csv_line(raw_line), fallback_date=fallback_date)
        if not row:
            invalid_rows += 1
            continue
        row_date, second, frequency = row
        if not row_date or second < 0:
            invalid_rows += 1
            continue
        local_date = local_date or row_date
        if row_date != local_date:
            invalid_rows += 1
            continue
        if not math.isfinite(frequency) or not (49.0 <= frequency <= 51.0):
            invalid_frequency += 1
            continue
        if second in samples:
            duplicate_samples += 1
        samples[second] = frequency

    if not local_date:
        raise ValueError("No TEIAS frequency rows found")
    return build_day_package(
        source="teias",
        local_date=datetime.strptime(local_date, "%Y-%m-%d").date(),
        timezone_name=TEIAS_TIMEZONE,
        samples_by_second=samples,
        source_url=source_url,
        sha256=sha256_bytes(data),
        downloaded_at_utc=downloaded_at_utc or utc_now_iso(),
        http_status=http_status,
        source_size=len(data),
        duplicate_samples=duplicate_samples,
        parsed_rows=parsed_rows,
        invalid_rows=invalid_rows,
        invalid_frequency_samples=invalid_frequency,
    )


def day_output_paths(package: DayPackage, data_root: Path) -> dict[str, Path]:
    year = package.local_date[0:4]
    month = package.local_date[5:7]
    stem = package.local_date.replace("-", "")
    day_dir = data_root / package.source / year / month
    return {
        "frequency": day_dir / f"{stem}.frequency.i16",
        "minute": day_dir / f"{stem}.minute.json",
        "hourly": day_dir / f"{stem}.hourly.json",
        "meta": day_dir / f"{stem}.meta.json",
    }


def write_day_outputs(package: DayPackage, data_root: str | Path = "data") -> dict[str, Path]:
    root = Path(data_root)
    paths = day_output_paths(package, root)
    write_frequency_i16(paths["frequency"], package.encoded)
    write_json(paths["minute"], package.minute)
    write_json(paths["hourly"], package.hourly)
    write_json(paths["meta"], package.meta)
    return paths


def iter_meta_files(data_root: Path, source: str | None = None) -> Iterable[Path]:
    pattern = f"{source}/20??/[01][0-9]/*.meta.json" if source else "*/20??/[01][0-9]/*.meta.json"
    return sorted(data_root.glob(pattern))


def rel_data_path(path: Path, data_root: Path) -> str:
    return path.relative_to(data_root).as_posix()


def build_source_index(data_root: str | Path, source: str, year: int = 2026) -> dict:
    root = Path(data_root)
    index: dict[str, object] = {
        "schemaVersion": 1,
        "source": source,
        "year": year,
        "updatedAtUtc": utc_now_iso(),
        "availableDates": [],
        "excludedDates": [],
        "days": {},
        "excludedDays": {},
    }
    for meta_path in iter_meta_files(root, source):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if not str(meta.get("localDate", "")).startswith(str(year)):
            continue
        local_date = meta["localDate"]
        stem = local_date.replace("-", "")
        month = local_date[5:7]
        base = root / source / str(year) / month
        files = {
            "frequency": rel_data_path(base / f"{stem}.frequency.i16", root),
            "minute": rel_data_path(base / f"{stem}.minute.json", root),
            "hourly": rel_data_path(base / f"{stem}.hourly.json", root),
            "meta": rel_data_path(base / f"{stem}.meta.json", root),
        }
        day_record = {
            "date": local_date,
            "timezone": meta["timezone"],
            "status": meta["status"],
            "qualityScore": meta["qualityScore"],
            "sha256": meta["sha256"],
            "expectedSamples": meta["expectedSamples"],
            "validSamples": meta["validSamples"],
            "files": files,
        }
        if meta.get("sourceMethod"):
            day_record["sourceMethod"] = meta["sourceMethod"]
        if meta.get("status") not in ACTIVE_STATUSES:
            index["excludedDates"].append(local_date)
            index["excludedDays"][local_date] = {
                **day_record,
                "reason": "invalid_frequency_day",
            }
            continue
        index["availableDates"].append(local_date)
        index["days"][local_date] = day_record
    index["availableDates"] = sorted(set(index["availableDates"]))
    index["excludedDates"] = sorted(set(index["excludedDates"]))
    write_json(root / source / str(year) / "index.json", index)
    return index


def manifest_years(root: Path) -> list[int]:
    years = set()
    for meta_path in iter_meta_files(root):
        try:
            years.add(int(meta_path.parts[-3]))
        except (IndexError, ValueError):
            continue
    return sorted(years)


def source_year_record(source_info: dict, year: int) -> dict:
    prefix = f"{year}-"
    days = {
        local_date: day
        for local_date, day in source_info.get("days", {}).items()
        if local_date.startswith(prefix)
    }
    files = {
        local_date: file_set
        for local_date, file_set in source_info.get("files", {}).items()
        if local_date.startswith(prefix)
    }
    excluded_dates = [
        local_date
        for local_date in source_info.get("excludedDates", [])
        if str(local_date).startswith(prefix)
    ]
    available_dates = sorted(days)
    return {
        **source_info,
        "firstDate": available_dates[0] if available_dates else None,
        "latestDate": available_dates[-1] if available_dates else None,
        "availableDates": available_dates,
        "excludedDates": sorted(excluded_dates),
        "days": days,
        "files": files,
    }


def write_split_manifest_files(root: Path, manifest: dict, years: list[int]) -> None:
    summary_sources = {}
    for source, source_info in manifest.get("sources", {}).items():
        summary_sources[source] = {
            "label": source_info.get("label"),
            "timezone": source_info.get("timezone"),
            "firstDate": source_info.get("firstDate"),
            "latestDate": source_info.get("latestDate"),
            "availableDates": source_info.get("availableDates", []),
            "excludedDates": source_info.get("excludedDates", []),
            "status": source_info.get("status"),
        }

    summary = {
        "schemaVersion": 2,
        "updatedAtUtc": manifest["updatedAtUtc"],
        "storage": manifest["storage"],
        "years": years,
        "sources": summary_sources,
        "shards": {str(year): f"manifest/{year}.json" for year in years},
        "fallback": "manifest.json",
    }
    write_json(root / "manifest-summary.json", summary)

    for year in years:
        year_manifest = {
            "schemaVersion": 2,
            "updatedAtUtc": manifest["updatedAtUtc"],
            "storage": manifest["storage"],
            "year": year,
            "sources": {},
        }
        for source, source_info in manifest.get("sources", {}).items():
            record = source_year_record(source_info, year)
            if record["availableDates"] or record["excludedDates"]:
                year_manifest["sources"][source] = record
        write_json(root / "manifest" / f"{year}.json", year_manifest)


def build_manifest(data_root: str | Path = "data") -> dict:
    root = Path(data_root)
    sources: dict[str, dict] = {}
    years = manifest_years(root)
    for source in sorted({path.parts[-4] for path in iter_meta_files(root)}):
        source_indexes = [build_source_index(root, source, year) for year in years]
        dates = sorted({date for index in source_indexes for date in index["availableDates"]})
        excluded_dates = sorted({date for index in source_indexes for date in index.get("excludedDates", [])})
        label = SOURCE_LABELS.get(source, source)
        timezone = None
        files: dict[str, dict] = {}
        days: dict[str, dict] = {}
        for index in source_indexes:
            for local_date, day in index["days"].items():
                timezone = timezone or day["timezone"]
                days[local_date] = day
                files[local_date] = day["files"]
        if timezone is None:
            for index in source_indexes:
                for day in index.get("excludedDays", {}).values():
                    timezone = day["timezone"]
                    break
                if timezone:
                    break
        sources[source] = {
            "label": label,
            "timezone": timezone,
            "firstDate": dates[0] if dates else None,
            "latestDate": dates[-1] if dates else None,
            "availableDates": dates,
            "excludedDates": excluded_dates,
            "days": days,
            "status": "active" if source == "teias" else (
                "automatic_update"
                if any(day.get("sourceMethod") in {"api", "official_zip"} for day in days.values())
                else "manual_monthly_import"
            ),
            "files": files,
        }

    manifest = {
        "schemaVersion": 1,
        "updatedAtUtc": utc_now_iso(),
        "storage": {"type": "github-pages", "baseUrl": "./data"},
        "sources": sources,
    }
    write_json(root / "manifest.json", manifest)
    write_split_manifest_files(root, manifest, years)
    return manifest
