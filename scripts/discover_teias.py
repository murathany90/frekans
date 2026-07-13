from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.request import Request, urlopen

SOURCE_PAGE_URL = "https://www.teias.gov.tr/gunluk-frekans-bilgisi"
GALLERY_API_URL = "https://www.teias.gov.tr/api/gallery?locale=tr-TR&slug=gunluk-frekans-bilgisi"
WEBIM_FILE_BASE_URL = "https://webim.teias.gov.tr/file"


@dataclass(frozen=True)
class TeiasEntry:
    local_date: str
    name: str
    slug: str
    mime: str
    size: int
    file_url: str
    source_page_url: str = SOURCE_PAGE_URL


def entries_from_gallery_payload(payload: dict[str, Any]) -> list[TeiasEntry]:
    if not payload.get("success"):
        raise ValueError("TEIAS gallery API did not return success=true")
    media = payload.get("payload", {}).get("media", [])
    if not isinstance(media, list):
        raise ValueError("TEIAS gallery API payload.media is not a list")

    entries: list[TeiasEntry] = []
    for item in media:
        title = str(item.get("title") or "").strip()
        name = str(item.get("name") or "").strip()
        date_token = title if title.isdigit() and len(title) == 8 else name[:8]
        if not (date_token.isdigit() and len(date_token) == 8):
            continue
        if not name.lower().endswith((".csv", ".txt", ".zip")):
            continue
        slug = str(item.get("slug") or "").strip()
        if not slug:
            continue
        local_date = f"{date_token[0:4]}-{date_token[4:6]}-{date_token[6:8]}"
        entries.append(
            TeiasEntry(
                local_date=local_date,
                name=name,
                slug=slug,
                mime=str(item.get("mime") or ""),
                size=int(item.get("size") or 0),
                file_url=f"{WEBIM_FILE_BASE_URL}/{slug}?download",
            )
        )
    return sorted(entries, key=lambda entry: entry.local_date)


def fetch_gallery_payload(timeout: int = 30) -> dict[str, Any]:
    request = Request(GALLERY_API_URL, headers={"User-Agent": "zfrekans-rapor-data-bot/1.0"})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def discover_teias_entries(timeout: int = 30) -> list[TeiasEntry]:
    return entries_from_gallery_payload(fetch_gallery_payload(timeout=timeout))


def entry_by_date(local_date: str, entries: list[TeiasEntry] | None = None) -> TeiasEntry | None:
    for entry in entries if entries is not None else discover_teias_entries():
        if entry.local_date == local_date:
            return entry
    return None


def main() -> int:
    entries = discover_teias_entries()
    print(json.dumps([entry.__dict__ for entry in entries], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
