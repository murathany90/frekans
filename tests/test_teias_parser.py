from scripts import discover_teias
from scripts.discover_teias import entries_from_gallery_payload
from scripts.normalize_frequency import parse_teias_csv


def test_teias_gallery_payload_maps_official_slug_to_download_url():
    payload = {
        "success": True,
        "payload": {
            "media": [
                {
                    "slug": "9047b3c1-82e9-4564-bb32-c323d1db1548",
                    "name": "20260628.csv",
                    "title": "20260628",
                    "mime": "text/csv",
                    "size": 3272090,
                },
                {"slug": "not-a-date", "name": "readme.txt", "title": "readme"},
            ]
        },
    }

    entries = entries_from_gallery_payload(payload)

    assert len(entries) == 1
    assert entries[0].local_date == "2026-06-28"
    assert entries[0].file_url == (
        "https://webim.teias.gov.tr/file/9047b3c1-82e9-4564-bb32-c323d1db1548?download"
    )
    assert entries[0].source_page_url == "https://www.teias.gov.tr/gunluk-frekans-bilgisi"


def test_teias_gallery_discovery_retries_transient_timeout(monkeypatch):
    payload = {
        "success": True,
        "payload": {
            "media": [
                {
                    "slug": "f5ce4a04-52a4-4a21-9559-c34ef8a3726a",
                    "name": "20260711.csv",
                    "title": "20260711",
                    "mime": "text/csv",
                    "size": 3272090,
                }
            ]
        },
    }
    calls = []

    def fake_fetch_gallery_payload(timeout=30):
        calls.append(timeout)
        if len(calls) == 1:
            raise TimeoutError("temporary slow TEIAS gallery response")
        return payload

    monkeypatch.setattr(discover_teias, "fetch_gallery_payload", fake_fetch_gallery_payload)

    entries = discover_teias.discover_teias_entries(timeout=9, retries=2, retry_delay=0)

    assert [entry.local_date for entry in entries] == ["2026-07-11"]
    assert calls == [9, 9]


def test_teias_parser_accepts_legacy_comma_csv_without_date_column():
    data = "\n".join(
        [
            "Zaman,Sıra,Sistem Frekansı",
            "00:00:00,0,50.007",
            "00:00:01,1,50.006",
            "00:00:02,2,49.999",
        ]
    ).encode("utf-8")

    package = parse_teias_csv(
        data,
        source_url="https://webim.teias.gov.tr/file/example?download",
        fallback_date="2025-01-01",
    )

    assert package.local_date == "2025-01-01"
    assert package.valid_samples == 3
    assert package.meta["validSamples"] == 3
