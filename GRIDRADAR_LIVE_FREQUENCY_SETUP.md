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
- **Cloudflare Worker deploy edildi ve production'da çalışıyor.**
- **GridRadar API bağlantısı doğrulandı ve gerçek frekans verisi toplanıyor.**
- **Frontend production API URL'si gerçek Worker URL'siyle güncellendi.**

## Worker Bilgileri

- Worker adı: `gridfreq-live-frequency`
- Worker URL: `https://gridfreq-live-frequency.murathan-yeniceli.workers.dev`
- Durable Object binding: `FREQUENCY_STORE`
- Durable Object class: `FrequencyStore`
- Durable Object adı: `continental-europe`
- Cron: `*/15 * * * *`
- Normal alarm döngüsü: 60 saniye
- Retention: 24 saat
- Kullanılmayan servisler: D1, KV, R2
- Deploy tarihi: 2026-07-18

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

## Deploy Durumu

Cloudflare Worker başarıyla deploy edildi:

- Worker Version ID: `98430784-8ef2-40a3-a994-f32474c1d95c`
- Worker URL: `https://gridfreq-live-frequency.murathan-yeniceli.workers.dev`
- Cron Trigger: `*/15 * * * *` aktif
- Durable Object: `FrequencyStore` aktif, SQLite migration uygulandı
- GRIDRADAR_TOKEN: Cloudflare secret olarak tanımlı

## GridRadar API Bağlantı Durumu

- Authentication: **Başarılı**
- İlk gerçek veri toplama: 2026-07-18T01:47:15Z
- Collector durumu: `healthy`
- Son erişilebilir frekans: 49.9879 Hz (deploy sonrası ilk kontrol)
- Kaynak gecikmesi: ~16 dakika (beklenen ~15 dakika)
- Frekans aralığı: 49.96–50.03 Hz (normal UCTE aralığı)
- Valid sample ratio: 100%

## Frontend Production Config

```javascript
window.GRIDFREQ_CONFIG = Object.freeze({
  liveApiBaseUrl: "https://gridfreq-live-frequency.murathan-yeniceli.workers.dev"
});
```

## CORS

- `Access-Control-Allow-Origin: https://gridfreq.com` ✅
- `Vary: Origin` ✅
- `X-Content-Type-Options: nosniff` ✅

## Test Sonuçları (2026-07-18)

- `python -m pytest tests -q`: 45 passed ✅
- `node tests/frontend_static_smoke.mjs`: passed ✅
- `python scripts/validate_frequency.py`: `issues: []` ✅
- `python scripts/build_site.py`: `dataIssues: []` ✅
- `cd live-frequency-worker; npm test`: 23 passed ✅
- `cd live-frequency-worker; npm run typecheck`: passed ✅
- `cd live-frequency-worker; npm run deploy:dry-run`: passed ✅
- `node tests/frontend_live_frequency_static.mjs`: passed ✅
- `node tests/frontend_hash_routing_static.mjs`: passed ✅
- `node tests/frontend_live_frequency_playwright.mjs`: passed ✅
- Worker smoke testleri (`/health`, `/v1/live/status`, `/v1/live/series`, `/v1/live/delta`): passed ✅

## Bilinen Sınırlar

- İlk deploy sonrası 24 saatlik tamponun tam dolması zaman alır.
- `api.gridfreq.com` özel alan adı bu ilk sürüm için zorunlu değildir; isteğe bağlı sonraki aşamadır.
- GitHub Actions ile Worker deploy isteğe bağlıdır ve repo secrets yoksa deploy adımı güvenli şekilde atlanır.
