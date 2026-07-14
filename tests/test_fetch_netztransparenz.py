import io
import json
import zipfile
from datetime import date

import pytest

from scripts.fetch_netztransparenz import (
    build_official_csv_request,
    detect_response_format,
    discover_frequency_endpoint,
    find_missing_dates,
    normalize_local_timestamps,
    parse_frequency_payload,
    split_into_utc_days,
    update_status,
    validate_frequency_records,
)


def zipped_csv(text: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("frequency.csv", text)
    return buffer.getvalue()


def test_discover_frequency_endpoint_rejects_nrvsaldo_swagger():
    swagger = {
        "paths": {
            "/api/v1/data/NrvSaldo/{datatype}/{product}/{dateFrom}/{dateTo}": {
                "get": {
                    "parameters": [
                        {"name": "datatype", "schema": {"enum": ["NRVSaldo", "RZSaldo"]}},
                        {"name": "product", "schema": {"enum": ["Betrieblich", "Qualitaetsgesichert"]}},
                    ]
                }
            }
        }
    }

    result = discover_frequency_endpoint({"swagger": swagger})

    assert result["endpointFound"] is False
    assert result["frequencyData"] == ""
    assert result["frequencyProduct"] == ""
    assert "NRVSaldo" in result["rejectedCandidates"]


def test_build_official_csv_request_uses_hz_frequency_product_not_mw():
    request = build_official_csv_request(date(2026, 7, 1), date(2026, 7, 2))
    settings = request["payload"]["Settings"]

    assert settings["ProduktId"] == 35
    assert settings["DataUnit"] == "Hz"
    assert settings["Title"] == "Sekuendliche Frequenz"
    assert settings["ProduktId"] != 33
    assert settings["DataUnit"] != "MW"


def test_detect_response_format_and_parse_csv_decimal_comma_and_dot():
    data = "\ufeffDatum;Zeit;Frequenz\n01.07.2026;00:00:00;50,001\n01.07.2026;00:00:01;50.002\n".encode(
        "utf-8"
    )

    assert detect_response_format(data) == "csv"
    records = parse_frequency_payload(data, requested_from="2026-07-01", requested_to="2026-07-01")

    assert [record["local_date"] for record in records] == ["2026-07-01", "2026-07-01"]
    assert [record["local_time"] for record in records] == ["00:00:00", "00:00:01"]
    assert records[0]["frequency_hz"] == pytest.approx(50.001)
    assert records[1]["frequency_hz"] == pytest.approx(50.002)


def test_parse_zip_payload_and_reject_bad_products():
    records = parse_frequency_payload(
        zipped_csv("Datum;Zeit;Frequenz\n01.07.2026;00:00:00;50.001\n"),
        requested_from="2026-07-01",
        requested_to="2026-07-01",
    )
    assert len(records) == 1

    bad_payloads = [
        b"<html><title>Login</title><form>client</form></html>",
        b"Datum;Zeit;Leistung (MW)\n01.07.2026;00:00:00;1000\n",
        b"Datum;Zeit;Frequenz\n01.07.2026;00:00:00;1000\n",
        b"Datum;Zeit;Wert\n01.07.2026;00:00:00;50.0\n",
    ]
    for payload in bad_payloads:
        with pytest.raises(ValueError):
            parse_frequency_payload(payload, requested_from="2026-07-01", requested_to="2026-07-01")


def test_validate_frequency_records_rejects_duplicates_and_wrong_range():
    duplicate_records = [
        {"local_date": "2026-07-01", "local_time": "00:00:00", "frequency_hz": 50.0},
        {"local_date": "2026-07-01", "local_time": "00:00:00", "frequency_hz": 50.0},
    ]
    with pytest.raises(ValueError, match="duplicate"):
        validate_frequency_records(duplicate_records, requested_from="2026-07-01", requested_to="2026-07-01")

    wrong_range = [{"local_date": "2026-08-01", "local_time": "00:00:00", "frequency_hz": 50.0}]
    with pytest.raises(ValueError, match="requested"):
        validate_frequency_records(wrong_range, requested_from="2026-07-01", requested_to="2026-07-01")


def test_normalize_local_timestamps_forward_fills_short_gaps_only():
    records = [
        {"local_date": "2026-07-01", "local_time": "00:00:00", "frequency_hz": 50.000},
        {"local_date": "2026-07-01", "local_time": "00:00:04", "frequency_hz": 50.004},
        {"local_date": "2026-07-01", "local_time": "00:00:10", "frequency_hz": 50.010},
    ]

    normalized = normalize_local_timestamps(records)
    samples = normalized.samples_by_day["2026-07-01"]

    assert samples[0] == pytest.approx(50.000)
    assert samples[1] == pytest.approx(50.000)
    assert samples[2] == pytest.approx(50.000)
    assert samples[3] == pytest.approx(50.000)
    assert samples[4] == pytest.approx(50.004)
    assert 5 not in samples
    assert normalized.raw_record_count == 3
    assert normalized.normalized_record_count == 6
    assert normalized.forward_filled_seconds == 3
    assert normalized.gaps_over_four_seconds == 1
    assert normalized.largest_gap_seconds == 6


def test_split_into_utc_days_handles_cet_cest_and_dst_days():
    records = [
        {"local_date": "2026-03-29", "local_time": "01:59:59", "frequency_hz": 50.0},
        {"local_date": "2026-03-29", "local_time": "03:00:00", "frequency_hz": 50.0},
        {"local_date": "2026-10-25", "local_time": "02:00:00", "frequency_hz": 50.0},
        {"local_date": "2026-10-25", "local_time": "02:00:01", "frequency_hz": 50.0},
    ]

    normalized = normalize_local_timestamps(records)
    days = split_into_utc_days(normalized)

    assert set(days) == {"2026-03-29", "2026-10-25"}
    assert normalized.expected_samples_by_day["2026-03-29"] == 23 * 3600
    assert normalized.expected_samples_by_day["2026-10-25"] == 25 * 3600


def test_find_missing_dates_july_fixture_preserves_valid_and_skips_publication_lag(tmp_path):
    data_root = tmp_path / "data"
    valid_dir = data_root / "netztransparenz" / "2026" / "07"
    valid_dir.mkdir(parents=True)
    (valid_dir / "20260701.meta.json").write_text(
        json.dumps({"localDate": "2026-07-01", "status": "complete", "sha256": "abc", "sourceMethod": "manual"}),
        encoding="utf-8",
    )
    (valid_dir / "20260701.frequency.i16").write_bytes(b"\0\0")
    (valid_dir / "20260702.meta.json").write_text(
        json.dumps({"localDate": "2026-07-02", "status": "invalid", "sha256": "bad"}),
        encoding="utf-8",
    )

    result = find_missing_dates(
        date(2026, 7, 1),
        date(2026, 7, 13),
        data_root=data_root,
        publication_lag_days=4,
        today=date(2026, 7, 14),
    )

    assert "2026-07-01" in result["existingValidDates"]
    assert "2026-07-02" in result["invalidDates"]
    assert result["missingDates"][0] == "2026-07-02"
    assert result["missingDates"][-1] == "2026-07-10"
    assert result["notYetPublishedDates"] == ["2026-07-11", "2026-07-12", "2026-07-13"]


def test_update_status_extends_existing_status_with_netztransparenz_section(tmp_path):
    data_root = tmp_path / "data"
    data_root.mkdir()
    (data_root / "status.json").write_text(json.dumps({"lastWorkflowResult": "success"}), encoding="utf-8")
    summary = {
        "status": "partial",
        "sourceMethod": "official_zip",
        "processed": [{"date": "2026-07-01", "status": "complete", "rawRecordCount": 3, "normalizedRecordCount": 5}],
        "missingDates": ["2026-07-02"],
        "notYetPublishedDates": ["2026-07-11"],
        "invalidDates": [],
        "latestPublishedDate": "2026-07-10",
        "requestedFrom": "2026-07-01",
        "requestedTo": "2026-07-13",
    }

    update_status(data_root, summary)

    status = json.loads((data_root / "status.json").read_text(encoding="utf-8"))
    netz = status["netztransparenz"]
    assert status["lastWorkflowResult"] == "success"
    assert netz["status"] == "partial"
    assert netz["sourceMethod"] == "official_zip"
    assert netz["lastSuccessfulDataDate"] == "2026-07-01"
    assert netz["missingDates"] == ["2026-07-02"]
    assert netz["notYetPublishedDates"] == ["2026-07-11"]
