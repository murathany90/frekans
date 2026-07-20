from __future__ import annotations

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


def test_teias_main_returns_failure_when_fetch_summary_has_failed_entries(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["fetch_teias.py"])
    monkeypatch.setattr(fetch_teias, "run", lambda _args: {"failed": ["2026-07-11: read timeout"]})

    assert fetch_teias.main() == 1
