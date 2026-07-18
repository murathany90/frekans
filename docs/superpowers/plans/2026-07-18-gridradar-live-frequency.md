# GridRadar Live Frequency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GridRadar-backed, 15-minute-delayed live Continental Europe frequency view to GridFreq with a Cloudflare Worker and one SQLite-backed Durable Object.

**Architecture:** Keep GitHub Pages as the static frontend and add a separate `live-frequency-worker/` TypeScript project for secret-bearing API access, polling, storage, and public REST endpoints. The frontend gets a new `#/live-frequency` route and separate `assets/live-frequency.js` / `assets/live-frequency.css` assets, with only minimal hooks in `frekans_rapor_v1.html`.

**Tech Stack:** Static HTML/vanilla JS/ECharts frontend; Cloudflare Workers + Durable Objects SQLite; Wrangler 4.x; TypeScript; Vitest; existing Python and Node static/Playwright checks.

---

## Files

- Create: `live-frequency-worker/package.json`
- Create: `live-frequency-worker/package-lock.json`
- Create: `live-frequency-worker/tsconfig.json`
- Create: `live-frequency-worker/vitest.config.ts`
- Create: `live-frequency-worker/wrangler.jsonc`
- Create: `live-frequency-worker/.dev.vars.example`
- Create: `live-frequency-worker/src/types.ts`
- Create: `live-frequency-worker/src/constants.ts`
- Create: `live-frequency-worker/src/encoding.ts`
- Create: `live-frequency-worker/src/validation.ts`
- Create: `live-frequency-worker/src/gridradar-client.ts`
- Create: `live-frequency-worker/src/frequency-store.ts`
- Create: `live-frequency-worker/src/api-routes.ts`
- Create: `live-frequency-worker/src/index.ts`
- Create: `live-frequency-worker/test/fixtures/*.json`
- Create: `live-frequency-worker/test/*.test.ts`
- Create: `assets/live-frequency.js`
- Create: `assets/live-frequency.css`
- Modify: `frekans_rapor_v1.html`
- Create: `tests/frontend_live_frequency_static.mjs`
- Create: `tests/frontend_live_frequency_playwright.mjs`
- Create: `.github/workflows/deploy-live-frequency-worker.yml`
- Create: `live-frequency-worker/README.md`
- Create: `GRIDRADAR_LIVE_FREQUENCY_SETUP.md`
- Create: `MANUAL_STEPS.md`

## Task 1: Worker Scaffold and Config

**Files:**
- Create: `live-frequency-worker/package.json`
- Create: `live-frequency-worker/tsconfig.json`
- Create: `live-frequency-worker/vitest.config.ts`
- Create: `live-frequency-worker/wrangler.jsonc`
- Create: `live-frequency-worker/.dev.vars.example`

- [ ] Create the TypeScript Worker package with scripts: `test`, `typecheck`, `build`, `wrangler:types`, `dev`, `deploy:dry-run`, `deploy`.
- [ ] Use Wrangler 4.x and current config keys: `durable_objects.bindings`, `migrations[].new_sqlite_classes`, and `triggers.crons`.
- [ ] Define one binding: `FREQUENCY_STORE` -> `FrequencyStore`.
- [ ] Define one object name in code: `continental-europe`.
- [ ] Keep `.dev.vars.example` free of real secrets.
- [ ] Run `npm install` in `live-frequency-worker/`.
- [ ] Run `npm run typecheck` and verify expected initial failures only if source files are not created yet.

## Task 2: Parser, Validation, and Encoding With TDD

**Files:**
- Create: `live-frequency-worker/src/types.ts`
- Create: `live-frequency-worker/src/constants.ts`
- Create: `live-frequency-worker/src/encoding.ts`
- Create: `live-frequency-worker/src/validation.ts`
- Create: `live-frequency-worker/src/gridradar-client.ts`
- Create: `live-frequency-worker/test/gridradar-client.test.ts`
- Create: `live-frequency-worker/test/encoding.test.ts`
- Create: `live-frequency-worker/test/fixtures/*.json`

- [ ] Write failing parser tests for `datapoints`, `data`, Grafana arrays, `[value,timestamp]`, `[timestamp,value]`, RFC3339 timestamps, millisecond timestamps, empty responses, bad frequency values, and bad timestamps.
- [ ] Run `npm test -- gridradar-client` and confirm tests fail because parser code is missing.
- [ ] Implement `parseGridRadarJson()` and `validateFrequencySample()` with frequency acceptance limited to 45-55 Hz.
- [ ] Write failing encoding tests for 50.0000 -> 0, 49.9985 -> -15, 50.0214 -> 214, Int16 limits, and decode round trip.
- [ ] Run `npm test -- encoding` and confirm tests fail before implementation.
- [ ] Implement `encodeFrequencyHz()` and `decodeFrequencyValue()`.
- [ ] Re-run parser and encoding tests and keep them green.

## Task 3: SQLite Chunk Storage With TDD

**Files:**
- Create: `live-frequency-worker/src/frequency-store.ts`
- Create: `live-frequency-worker/test/chunks.test.ts`
- Create: `live-frequency-worker/test/api-routes.test.ts`

- [ ] Write failing pure chunk tests for 15-minute chunk start, second index, duplicate-second replacement, validity bitmap, stats, multi-block ingest, and retention filtering.
- [ ] Implement pure helpers first: `chunkStartMs()`, `sampleIndexInChunk()`, `createEmptyChunkBuffers()`, `setChunkSample()`, and `summarizeChunk()`.
- [ ] Implement SQLite schema initialization inside `FrequencyStore` using `this.ctx.storage.sql.exec`.
- [ ] Store each 15-minute block as one row with `samples` and `validity_bitmap` blobs.
- [ ] Add retention deletion based on measurement time and ensure only the last 24 hours are returned.
- [ ] Re-run chunk tests and keep them green.

## Task 4: API Routes, CORS, Cache, and Alarm Loop

**Files:**
- Create: `live-frequency-worker/src/api-routes.ts`
- Modify: `live-frequency-worker/src/frequency-store.ts`
- Create: `live-frequency-worker/test/api-routes.test.ts`
- Create: `live-frequency-worker/test/alarm-backoff.test.ts`

- [ ] Write failing API tests for `/health`, `/v1/live/status`, minute summaries, max-one-hour raw series, invalid `from/to`, CORS allow/deny, OPTIONS, cache headers, and delta.
- [ ] Implement route parsing and validation with only GET/OPTIONS public methods.
- [ ] Add `Vary: Origin`, `X-Content-Type-Options: nosniff`, and endpoint-specific `Cache-Control`.
- [ ] Add `caches.default` read-through caching for status/series endpoints and `no-store` for delta.
- [ ] Write failing backoff tests for 401/403, 408, 429, 500, network errors, empty responses, and successful reset to 60 seconds.
- [ ] Implement DO `alarm()` collection with idempotent ingest and `finally` scheduling of the next alarm.
- [ ] Implement Worker `scheduled()` as a 15-minute watchdog that wakes `continental-europe` and ensures the alarm is running.

## Task 5: Frontend Live Frequency Route

**Files:**
- Modify: `frekans_rapor_v1.html`
- Create: `assets/live-frequency.js`
- Create: `assets/live-frequency.css`
- Create: `tests/frontend_live_frequency_static.mjs`
- Create: `tests/frontend_live_frequency_playwright.mjs`

- [ ] Write a failing static frontend test requiring `#/live-frequency`, `tab-live-frequency`, `assets/live-frequency.js`, `assets/live-frequency.css`, and `window.GRIDFREQ_CONFIG.liveApiBaseUrl`.
- [ ] Add the stylesheet and module script tags to the head.
- [ ] Add the nav button and `tab-live-frequency` section with stable IDs for KPI cards, status, range controls, chart, and source details.
- [ ] Extend `ROUTE_TAB_TO_PATH`, `ROUTE_PATH_TO_TAB`, `parseHashRoute()`, and `activateTab()` with `live-frequency`.
- [ ] Implement the frontend module with initial status + 24h minute summary loading, ECharts rendering, 60-second delta polling, Page Visibility pause/resume, route cleanup, and one-hour raw-detail fetch cache.
- [ ] Add mobile-safe CSS with no horizontal page scroll and theme-compatible colors.
- [ ] Re-run the static frontend test and existing route smoke tests.

## Task 6: Documentation, Workflow, Deployment, and Verification

**Files:**
- Create: `.github/workflows/deploy-live-frequency-worker.yml`
- Create: `live-frequency-worker/README.md`
- Create: `GRIDRADAR_LIVE_FREQUENCY_SETUP.md`
- Create: `MANUAL_STEPS.md`
- Modify: `frekans_rapor_v1.html` after deploy with actual Worker URL.

- [ ] Add a workflow that runs only for `live-frequency-worker/**`, uses `npm ci`, `npm test`, `npm run typecheck`, and deploys only when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are present.
- [ ] Document architecture, endpoints, secrets, retention, alarms, cron, encoding, free-limit behavior, and optional custom domain.
- [ ] Run `npx wrangler whoami` from `live-frequency-worker/`.
- [ ] Run `npx wrangler secret list`; if `GRIDRADAR_TOKEN` is absent, start `npx wrangler secret put GRIDRADAR_TOKEN` and ask the user to paste the token into the hidden terminal prompt only.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, `npm run deploy:dry-run`, and `npm run deploy`.
- [ ] Capture the `workers.dev` URL and smoke-test `/health`, `/v1/live/status`, `/v1/live/series?range=24h&resolution=60s`, and CORS with `https://gridfreq.com`.
- [ ] Update `window.GRIDFREQ_CONFIG.liveApiBaseUrl` to the real Worker URL.
- [ ] Run root checks: `python -m pytest tests -q`, `python scripts/validate_frequency.py`, `node tests/frontend_static_smoke.mjs`, `node tests/frontend_hash_routing_static.mjs`, `node tests/frontend_live_frequency_static.mjs`, `python scripts/build_site.py`, and targeted Playwright live-frequency smoke.
- [ ] Commit in logical groups and push `feat/gridradar-live-frequency`; open a PR with GitHub CLI if authenticated.
