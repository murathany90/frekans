import json
from datetime import date

import pytest

from scripts.normalize_frequency import (
    MISSING_SENTINEL,
    build_day_package,
    build_manifest,
    decode_frequency_array,
    encode_frequency_array,
    expected_seconds_for_local_day,
    parse_teias_csv,
    write_day_outputs,
)


def test_int16_encoding_round_trips_frequency_values_and_missing_samples():
    encoded = encode_frequency_array([50.0, 49.9876, None, float("nan"), 50.1234])

    assert list(encoded) == [0, -124, MISSING_SENTINEL, MISSING_SENTINEL, 1234]
    assert decode_frequency_array(encoded) == pytest.approx(
        [50.0, 49.9876, None, None, 50.1234], nan_ok=True
    )


def test_teias_parser_reports_missing_duplicate_and_invalid_seconds():
    text = "\n".join(
        [
            ";;;;00:00:00;0;49,967;28.06.2026;",
            ";;;;00:00:01;1;49,963;28.06.2026;",
            ";;;;00:00:01;1;49,964;28.06.2026;",
            ";;;;00:00:03;3;70,000;28.06.2026;",
            "<html>not csv</html>",
        ]
    )

    package = parse_teias_csv(text.encode("utf-8"), source_url="https://example.test/20260628.csv")

    assert package.local_date == "2026-06-28"
    assert package.valid_samples == 2
    assert package.duplicate_samples == 1
    assert package.invalid_frequency_samples == 1
    assert package.missing_samples == 86398
    assert package.status == "critical"


def test_build_day_package_computes_minute_and_hourly_outputs():
    samples = {0: 50.0, 1: 50.1, 60: 49.9, 3600: 50.2}

    package = build_day_package(
        source="teias",
        local_date=date(2026, 6, 28),
        timezone_name="Europe/Istanbul",
        samples_by_second=samples,
        source_url="https://example.test/20260628.csv",
        sha256="abc",
        downloaded_at_utc="2026-07-13T00:00:00Z",
        http_status=200,
        source_size=123,
        duplicate_samples=0,
        parsed_rows=4,
        invalid_rows=0,
        invalid_frequency_samples=0,
    )

    assert package.expected_samples == 86400
    assert package.minute[0]["averageHz"] == pytest.approx(50.05)
    assert package.minute[1]["averageHz"] == pytest.approx(49.9)
    assert package.hourly[0]["validSamples"] == 3
    assert package.hourly[1]["averageHz"] == pytest.approx(50.2)
    assert package.meta["startUtc"] == "2026-06-27T21:00:00Z"


def test_expected_seconds_uses_iana_timezone_day_lengths():
    assert expected_seconds_for_local_day(date(2026, 6, 1), "Europe/Berlin") == 86400
    assert expected_seconds_for_local_day(date(2026, 3, 29), "Europe/Berlin") == 82800
    assert expected_seconds_for_local_day(date(2026, 10, 25), "Europe/Berlin") == 90000


def test_write_day_outputs_and_manifest_include_versioned_paths(tmp_path):
    package = build_day_package(
        source="teias",
        local_date=date(2026, 6, 28),
        timezone_name="Europe/Istanbul",
        samples_by_second={0: 50.0},
        source_url="https://example.test/20260628.csv",
        sha256="hash-1",
        downloaded_at_utc="2026-07-13T00:00:00Z",
        http_status=200,
        source_size=10,
        duplicate_samples=0,
        parsed_rows=1,
        invalid_rows=0,
        invalid_frequency_samples=0,
    )

    write_day_outputs(package, tmp_path)
    manifest = build_manifest(tmp_path)

    day_dir = tmp_path / "teias" / "2026" / "06"
    assert (day_dir / "20260628.frequency.i16").stat().st_size == 172800
    assert manifest["storage"]["baseUrl"] == "./data"
    assert manifest["sources"]["teias"]["availableDates"] == ["2026-06-28"]
    assert manifest["sources"]["teias"]["files"]["2026-06-28"]["frequency"].endswith(
        "20260628.frequency.i16"
    )
    summary = json.loads((tmp_path / "manifest-summary.json").read_text(encoding="utf-8"))
    shard = json.loads((tmp_path / "manifest" / "2026.json").read_text(encoding="utf-8"))
    assert summary["shards"]["2026"] == "manifest/2026.json"
    assert summary["sources"]["teias"]["latestDate"] == "2026-06-28"
    assert shard["sources"]["teias"]["days"]["2026-06-28"]["files"]["frequency"].endswith(
        "20260628.frequency.i16"
    )


def test_manifest_excludes_invalid_days_from_active_dates(tmp_path):
    invalid_package = build_day_package(
        source="teias",
        local_date=date(2026, 5, 8),
        timezone_name="Europe/Istanbul",
        samples_by_second={},
        source_url="https://example.test/20260508.csv",
        sha256="hash-invalid",
        downloaded_at_utc="2026-07-13T00:00:00Z",
        http_status=200,
        source_size=10,
        duplicate_samples=0,
        parsed_rows=0,
        invalid_rows=1,
        invalid_frequency_samples=0,
    )

    write_day_outputs(invalid_package, tmp_path)
    manifest = build_manifest(tmp_path)

    teias = manifest["sources"]["teias"]
    assert teias["availableDates"] == []
    assert teias["excludedDates"] == ["2026-05-08"]
