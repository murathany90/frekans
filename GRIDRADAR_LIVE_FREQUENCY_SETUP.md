# GridRadar Live Frequency Setup

## Yapılan İşler

- `live-frequency-worker/` altında TypeScript Cloudflare Worker projesi oluşturuldu.
- SQLite tabanlı tek Durable Object sınıfı eklendi: `FrequencyStore`.
- Tek nesne adı kodda sabitlendi: `continental-europe`.
- GridRadar parser, Int16 encoding, 15 dakikalık chunk modeli, retention, API route ve backoff testleri eklendi.
- GitHub Pages frontendine `#/live-frequency` route'u ve `Canlı Frekans` sekmesi eklendi.
- Frontend canlı frekans kodu ayrı dosyalara taşındı: `assets/live-frequency.js` ve `assets/live-frequency.css`.
- Worker deploy workflow'u eklendi: `.github/workflows/deploy-live-frequency-worker.yml`.
- Mevcut frontend CI testlerine canlı frekans statik ve Playwright testleri eklendi.

## Worker Bilgileri

- Worker adı: `gridfreq-live-frequency`
- Worker URL'si: Wrangler oturumu yenilenip deploy tamamlanınca `workers.dev` URL'si burada ve `window.GRIDFREQ_CONFIG.liveApiBaseUrl` içinde güncellenecek.
- Durable Object binding: `FREQUENCY_STORE`
- Durable Object class: `FrequencyStore`
- Durable Object adı: `continental-europe`
- Cron: `*/15 * * * *`
- Normal alarm döngüsü: 60 saniye
- Retention: 24 saat
- Kullanılmayan servisler: D1, KV, R2

## API Endpointleri

- `GET /health`
- `GET /v1/live/status`
- `GET /v1/live/series?range=24h&resolution=60s`
- `GET /v1/live/series?from=<UTC>&to=<UTC>&resolution=1s`
- `GET /v1/live/delta?after=<timestamp_ms>`

## GridRadar Davranışı

- Kaynak: GridRadar
- Metrik: `frequency-ucte-median-1s`
- Beklenen kaynak gecikmesi: yaklaşık 15 dakika
- İlk 24 saat dolmadan frontend "24 saatlik veri tamponu hazırlanıyor" bilgisini gösterir.
- API hiç yeni veri dönmezse bu hata değil, yeni veri yok durumu olarak işlenir.

## Test Sonuçları

Bu branch üzerinde şimdiye kadar çalışan kontroller:

- `python -m pytest tests -q`: 45 passed
- `node tests/frontend_static_smoke.mjs`: passed
- `python scripts/validate_frequency.py`: `issues: []`
- `python scripts/build_site.py`: `dataIssues: []`
- `cd live-frequency-worker; npm test`: 23 passed
- `cd live-frequency-worker; npm run typecheck`: passed
- `cd live-frequency-worker; npm run deploy:dry-run`: passed
- `node tests/frontend_live_frequency_static.mjs`: passed
- `node tests/frontend_hash_routing_static.mjs`: passed
- `node tests/frontend_live_frequency_playwright.mjs`: passed with mock Worker API

## Deploy Durumu

Yerel `wrangler deploy --dry-run` başarılıdır. Gerçek Cloudflare deploy şu an tamamlanmadı çünkü `npx wrangler whoami` oturumun süresinin dolduğunu bildirdi:

```text
Not logged in. Your auth token has expired and could not be refreshed, and the environment is non-interactive.
```

Wrangler login yenilendikten sonra `GRIDRADAR_TOKEN` secret kontrolü, gerçek Worker deployu, `workers.dev` URL smoke testleri ve frontend production config güncellemesi yapılmalıdır.

## Bilinen Sınırlar

- Gerçek GridRadar verisi, `GRIDRADAR_TOKEN` Cloudflare secret olarak eklendikten ve Worker deploy edildikten sonra doğrulanabilir.
- İlk deploy sonrası tamponun dolması zaman alır; veri yok durumu tek başına deploy hatası değildir.
- `api.gridfreq.com` özel alan adı bu ilk sürüm için zorunlu değildir; isteğe bağlı sonraki aşamadır.
- GitHub Actions ile Worker deploy isteğe bağlıdır ve repo secrets yoksa deploy adımı güvenli şekilde atlanır.
