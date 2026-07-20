from __future__ import annotations

import json
import sys
from types import SimpleNamespace

from scripts import fetch_teias
from scripts.discover_teias import TeiasEntry


def make_args(tmp_path):
    return SimpleNamespace(
        date="2026-07-11",
        start=None,
        end=None,
        lookback_days=None,
        latest=False,
        dry_run=False,
        output_root=str(tmp_path),
        request_delay="0",
        catch_up_published=False,
        catch_up_days=45,
        discovery_timeout=9,
        discovery_retries=2,
        discovery_delay=0,
        download_timeout=180,
        download_retries=5,
    )


def test_teias_run_passes_download_retry_budget(monkeypatch, tmp_path):
    entry = TeiasEntry(
        local_date="2026-07-11",
        name="20260711.csv",
        slug="f5ce4a04-52a4-4a21-9559-c34ef8a3726a",
        mime="text/csv",
        size=3272090,
        file_url="https://webim.teias.gov.tr/file/f5ce4a04-52a4-4a21-9559-c34ef8a3726a?download",
    )
    captured = {}

    monkeypatch.setattr(fetch_teias, "discover_teias_entries", lambda **_: [entry])
    monkeypatch.setattr(fetch_teias, "build_manifest", lambda *_: None)
    monkeypatch.setattr(fetch_teias, "write_status", lambda *_: None)

    def fake_process_entry(entry_arg, data_root, dry_run=False, download_timeout=60, download_retries=3):
        captured["date"] = entry_arg.local_date
        captured["timeout"] = download_timeout
        captured["retries"] = download_retries
        return {"date": entry_arg.local_date, "status": "complete", "qualityScore": 100}

    monkeypatch.setattr(fetch_teias, "process_entry", fake_process_entry)

    summary = fetch_teias.run(make_args(tmp_path))

    assert summary["failed"] == []
    assert captured == {"date": "2026-07-11", "timeout": 180, "retries": 5}


def write_teias_meta(tmp_path, local_date: str, status: str = "complete"):
    stem = local_date.replace("-", "")
    meta_path = tmp_path / "teias" / local_date[:4] / local_date[5:7] / f"{stem}.meta.json"
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(
        json.dumps(
            {
                "source": "teias",
                "localDate": local_date,
                "status": status,
                "qualityScore": 100,
                "sha256": f"sha-{local_date}",
            }
        ),
        encoding="utf-8",
    )


def test_teias_catch_up_published_imports_discovered_gap_after_latest_local_day(monkeypatch, tmp_path):
    write_teias_meta(tmp_path, "2026-07-10")
    entries = [
        TeiasEntry(
            local_date=f"2026-07-{day:02d}",
            name=f"202607{day:02d}.csv",
            slug=f"slug-{day}",
            mime="text/csv",
            size=3272090,
            file_url=f"https://webim.teias.gov.tr/file/slug-{day}?download",
        )
        for day in range(11, 15)
    ]
    processed_dates = []
    args = make_args(tmp_path)
    args.date = "2026-07-15"
    args.catch_up_published = True
    args.catch_up_days = 30

    monkeypatch.setattr(fetch_teias, "discover_teias_entries", lambda **_: entries)
    monkeypatch.setattr(fetch_teias, "build_manifest", lambda *_: None)
    monkeypatch.setattr(fetch_teias, "write_status", lambda *_: None)

    def fake_process_entry(entry_arg, *_args, **_kwargs):
        processed_dates.append(entry_arg.local_date)
        return {"date": entry_arg.local_date, "status": "complete", "qualityScore": 100}

    monkeypatch.setattr(fetch_teias, "process_entry", fake_process_entry)

    summary = fetch_teias.run(args)

    assert processed_dates == ["2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14"]
    assert summary["catchUpPublishedDates"] == processed_dates
    assert summary["latestDiscoveredDate"] == "2026-07-14"
    assert summary["missing"] == ["2026-07-15"]


def test_teias_run_soft_skips_download_failure_for_existing_local_day(monkeypatch, tmp_path):
    write_teias_meta(tmp_path, "2026-07-11")
    entries = [
        TeiasEntry(
            local_date="2026-07-11",
            name="20260711.csv",
            slug="slug-11",
            mime="text/csv",
            size=3272090,
            file_url="https://webim.teias.gov.tr/file/slug-11?download",
        ),
        TeiasEntry(
            local_date="2026-07-14",
            name="20260714.csv",
            slug="slug-14",
            mime="text/csv",
            size=3272090,
            file_url="https://webim.teias.gov.tr/file/slug-14?download",
        ),
    ]
    processed_dates = []
    args = make_args(tmp_path)
    args.date = None
    args.start = "2026-07-11"
    args.end = "2026-07-14"

    monkeypatch.setattr(fetch_teias, "discover_teias_entries", lambda **_: entries)
    monkeypatch.setattr(fetch_teias, "build_manifest", lambda *_: None)
    monkeypatch.setattr(fetch_teias, "write_status", lambda *_: None)

    def fake_process_entry(entry_arg, *_args, **_kwargs):
        if entry_arg.local_date == "2026-07-11":
            raise TimeoutError("existing day refresh timed out")
        processed_dates.append(entry_arg.local_date)
        return {"date": entry_arg.local_date, "status": "complete", "qualityScore": 100}

    monkeypatch.setattr(fetch_teias, "process_entry", fake_process_entry)

    summary = fetch_teias.run(args)

    assert summary["failed"] == []
    assert summary["processed"] == [{"date": "2026-07-14", "status": "complete", "qualityScore": 100}]
    assert processed_dates == ["2026-07-14"]
    assert summary["skippedExistingFailures"] == ["2026-07-11: existing day refresh timed out"]


def test_teias_main_returns_failure_when_fetch_summary_has_failed_entries(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["fetch_teias.py"])
    monkeypatch.setattr(fetch_teias, "run", lambda _args: {"failed": ["2026-07-11: read timeout"]})

    assert fetch_teias.main() == 1


def test_teias_main_compacts_discovered_dates_in_cli_output(monkeypatch, capsys):
    discovered_dates = [f"2026-07-{day:02d}" for day in range(1, 26)]
    monkeypatch.setattr(sys, "argv", ["fetch_teias.py"])
    monkeypatch.setattr(
        fetch_teias,
        "run",
        lambda _args: {
            "processed": [],
            "missing": [],
            "failed": [],
            "discoveredCount": len(discovered_dates),
            "discoveredDates": discovered_dates,
            "latestDiscoveredDate": discovered_dates[-1],
        },
    )

    assert fetch_teias.main() == 0
    output = json.loads(capsys.readouterr().out)

    assert output["discoveredDates"] == {
        "count": 25,
        "first": "2026-07-01",
        "latest": "2026-07-25",
    }
