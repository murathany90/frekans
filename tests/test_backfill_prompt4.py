import json
from datetime import date

import pytest

from scripts.normalize_frequency import build_day_package, build_manifest, write_day_outputs


def tiny_package(source: str, day: date, samples: dict[int, float] | None = None):
    return build_day_package(
        source=source,
        local_date=day,
        timezone_name="Europe/Istanbul" if source == "teias" else "Europe/Berlin",
        samples_by_second=samples if samples is not None else {0: 50.0},
        source_url=f"https://example.test/{source}/{day.isoformat()}",
        sha256=f"hash-{source}-{day.isoformat()}",
        downloaded_at_utc="2026-07-14T00:00:00Z",
        http_status=200,
        source_size=10,
        duplicate_samples=0,
        parsed_rows=1,
        invalid_rows=0,
        invalid_frequency_samples=0,
    )


def test_prompt4_backfill_range_and_grouping_contract():
    from scripts.backfill_2025_2026 import (
        BACKFILL_END,
        BACKFILL_START,
        all_dates,
        group_status_ranges,
    )

    assert BACKFILL_START == date(2025, 1, 1)
    assert BACKFILL_END == date(2026, 7, 10)
    assert len(all_dates(BACKFILL_START, BACKFILL_END)) == 556
    assert group_status_ranges(
        [
            ("2025-01-01", "source_not_found"),
            ("2025-01-02", "source_not_found"),
            ("2025-01-04", "download_failed"),
        ]
    ) == [
        {"start": "2025-01-01", "end": "2025-01-02", "status": "source_not_found", "count": 2},
        {"start": "2025-01-04", "end": "2025-01-04", "status": "download_failed", "count": 1},
    ]


def test_prompt4_inventory_keeps_country_statuses_independent(tmp_path):
    from scripts.backfill_2025_2026 import inventory_data_root

    write_day_outputs(tiny_package("teias", date(2025, 1, 1)), tmp_path)
    write_day_outputs(tiny_package("netztransparenz", date(2025, 1, 2)), tmp_path)
    write_day_outputs(tiny_package("teias", date(2025, 1, 2), samples={}), tmp_path)
    build_manifest(tmp_path)

    inventory = inventory_data_root(tmp_path, date(2025, 1, 1), date(2025, 1, 3))

    assert inventory["sources"]["teias"]["byDate"]["2025-01-01"]["status"] == "available"
    assert inventory["sources"]["teias"]["byDate"]["2025-01-02"]["status"] == "invalid_quality"
    assert inventory["sources"]["teias"]["byDate"]["2025-01-03"]["status"] == "source_not_found"
    assert inventory["sources"]["netztransparenz"]["byDate"]["2025-01-01"]["status"] == "source_not_found"
    assert inventory["sources"]["netztransparenz"]["byDate"]["2025-01-02"]["status"] == "available"
    assert inventory["onlyTeiasDates"] == ["2025-01-01"]
    assert inventory["onlyNetztransparenzDates"] == ["2025-01-02"]


def test_prompt4_report_and_checkpoint_are_safe_and_complete(tmp_path):
    from scripts.backfill_2025_2026 import (
        checkpoint_payload,
        inventory_data_root,
        write_backfill_reports,
    )

    write_day_outputs(tiny_package("teias", date(2025, 1, 1)), tmp_path)
    write_day_outputs(tiny_package("teias", date(2025, 1, 2), samples={}), tmp_path)
    build_manifest(tmp_path)
    inventory = inventory_data_root(tmp_path, date(2025, 1, 1), date(2025, 1, 3))
    paths = write_backfill_reports(
        inventory,
        tmp_path / "reports" / "data_quality",
        size_report={
            "repoBeforeBytes": 1,
            "repoAfterBytes": 2,
            "distBeforeBytes": 3,
            "distAfterBytes": 4,
            "addedBytes": 1,
            "addedFileCount": 1,
            "pagesRemainingBytes": 1024,
        },
        download_stats={
            "apiRequests": 0,
            "zipDownloads": 0,
            "retries": 0,
            "http429": 0,
            "http4xx5xx": 0,
            "methods": ["official_zip", "official_teias"],
        },
    )
    report_text = paths["markdown"].read_text(encoding="utf-8")
    report_json = json.loads(paths["json"].read_text(encoding="utf-8"))
    checkpoint = checkpoint_payload(inventory, last_completed_source="teias", last_completed_date="2025-01-01")

    assert "| TEIAS | 3 | 1 | 1 | 1 | 33.33% |" in report_text
    assert "2025-01-02 - TEIAS - invalid_quality" in report_text
    assert "2025-01-03 - TEIAS - source_not_found" in report_text
    assert report_json["range"]["totalDays"] == 3
    assert checkpoint["rangeStart"] == "2025-01-01"
    assert checkpoint["rangeEnd"] == "2025-01-03"
    assert "secret" not in json.dumps(checkpoint).lower()
    assert "token" not in json.dumps(checkpoint).lower()


def test_prompt4_manifest_writes_2025_and_2026_shards(tmp_path):
    write_day_outputs(tiny_package("teias", date(2025, 1, 1)), tmp_path)
    write_day_outputs(tiny_package("teias", date(2026, 1, 1)), tmp_path)

    manifest = build_manifest(tmp_path)
    summary = json.loads((tmp_path / "manifest-summary.json").read_text(encoding="utf-8"))

    assert manifest["sources"]["teias"]["firstDate"] == "2025-01-01"
    assert summary["years"] == [2025, 2026]
    assert (tmp_path / "manifest" / "2025.json").exists()
    assert (tmp_path / "manifest" / "2026.json").exists()


def test_prompt4_dist_safety_rejects_raw_sources_and_large_files(tmp_path):
    from scripts.backfill_2025_2026 import assert_publishable_dist

    dist = tmp_path / "dist"
    (dist / "data").mkdir(parents=True)
    (dist / "data" / "raw.csv").write_text("time,frequency\n", encoding="utf-8")

    with pytest.raises(ValueError, match="raw"):
        assert_publishable_dist(dist, max_total_bytes=1024 * 1024, max_file_bytes=1024 * 1024)

    (dist / "data" / "raw.csv").unlink()
    (dist / "data" / "big.frequency.i16").write_bytes(b"0" * 2048)

    with pytest.raises(ValueError, match="single file"):
        assert_publishable_dist(dist, max_total_bytes=1024 * 1024, max_file_bytes=1024)
