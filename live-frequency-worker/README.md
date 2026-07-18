# GridFreq Live Frequency Worker

This Worker powers the GridFreq `Canlı Frekans` tab. It keeps the GridRadar token outside the browser and stores only the latest 24 hours of Continental Europe frequency data in one SQLite-backed Durable Object.

## Architecture

GridRadar API -> Cloudflare Worker -> one SQLite Durable Object named `continental-europe` -> public REST endpoints -> GitHub Pages frontend.

The frontend remains a static GitHub Pages app. The Worker is the only component that sends `Authorization: Bearer <GRIDRADAR_TOKEN>` to GridRadar.

## Project Layout

- `src/index.ts`: Worker entrypoint, Durable Object binding lookup, cron watchdog.
- `src/frequency-store.ts`: SQLite schema, chunk storage, retention, alarm collection loop.
- `src/gridradar-client.ts`: GridRadar `/query` client and tolerant parser.
- `src/api-routes.ts`: public REST routes, CORS, cache headers, parameter validation.
- `src/encoding.ts`: `round((frequencyHz - 50) * 10000)` Int16 encoding.
- `src/validation.ts`: timestamp and frequency validation.
- `test/*.test.ts`: parser, encoding, chunk, API, and backoff tests.

## Storage Model

The Durable Object stores 15-minute chunks, not one row per second. A 24-hour window is about 96 completed chunks plus the active chunk.

```sql
CREATE TABLE IF NOT EXISTS frequency_chunks (
  chunk_start_ms INTEGER PRIMARY KEY,
  samples BLOB NOT NULL,
  validity_bitmap BLOB NOT NULL,
  sample_count INTEGER NOT NULL,
  min_value INTEGER,
  max_value INTEGER,
  sum_value INTEGER,
  updated_at_ms INTEGER NOT NULL
);
```

Each sample is encoded as signed Int16:

```text
encoded = round((frequencyHz - 50.0) * 10000)
```

Missing seconds are represented by `validity_bitmap`. Retention is enforced by measurement time and deletes chunks older than 24 hours.

## Development

```powershell
npm ci
npm test
npm run typecheck
npm run deploy:dry-run
```

For local Worker development:

```powershell
npm run dev
```

Use `.dev.vars` locally if you need a real GridRadar smoke test. Do not commit `.dev.vars` or any token value.

## Secrets

Required Cloudflare secret:

```powershell
npx wrangler secret put GRIDRADAR_TOKEN
```

Paste the token only into Wrangler's secret input. Do not send it in chat, write it to `.dev.vars.example`, or commit it.

## Endpoints

- `GET /health`
- `GET /v1/live/status`
- `GET /v1/live/series?range=24h&resolution=60s`
- `GET /v1/live/series?from=<UTC>&to=<UTC>&resolution=1s`
- `GET /v1/live/delta?after=<timestamp_ms>`

Only `GET` and `OPTIONS` are public. CORS allowlist is configured in `wrangler.jsonc` with `ALLOWED_ORIGINS`.

## Alarm and Cron

The Durable Object alarm is the normal collector loop and runs every 60 seconds after successful collection. The Worker cron runs every 15 minutes as a watchdog and calls the `continental-europe` object to ensure an alarm is scheduled.

Backoff behavior:

- 401/403: 15 minutes.
- 408: next normal cycle.
- 429: 120 seconds, then 300 seconds, then 600 seconds.
- 500/network: 300 seconds.

## Deploy

```powershell
npx wrangler whoami
npx wrangler secret list
npm run deploy:dry-run
npm run deploy
```

After deployment, put the final `workers.dev` URL in `window.GRIDFREQ_CONFIG.liveApiBaseUrl` in `frekans_rapor_v1.html`.

The optional GitHub Actions workflow uses these repository secrets when they exist:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Local Wrangler deployment is enough for the first release.
