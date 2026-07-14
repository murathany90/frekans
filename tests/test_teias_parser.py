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
