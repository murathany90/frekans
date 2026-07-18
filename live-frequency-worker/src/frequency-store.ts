import {
  CHUNK_MILLISECONDS,
  CHUNK_SECONDS,
  GRIDRADAR_METRIC,
  NOMINAL_FREQUENCY_HZ,
  POLL_INTERVAL_SECONDS,
  RETENTION_SECONDS,
  SOURCE_DELAY_SECONDS
} from "./constants";
import { cloneArrayBuffer, decodeFrequencyValue, encodeFrequencyHz } from "./encoding";
import { fetchGridRadarSamples } from "./gridradar-client";
import type {
  ChunkBuffer,
  ChunkSummary,
  CollectionResult,
  Env,
  FrequencySample,
  FrequencyStoreApi,
  HealthPayload,
  LiveStatusPayload,
  MinuteSeriesPoint
} from "./types";

export { CHUNK_SECONDS };

interface FrequencyChunkRow {
  chunk_start_ms: number;
  samples: ArrayBuffer;
  validity_bitmap: ArrayBuffer;
  sample_count: number;
  min_value: number | null;
  max_value: number | null;
  sum_value: number | null;
  updated_at_ms: number;
}

interface StateRow {
  value: string;
}

function bitmapByteLength(): number {
  return Math.ceil(CHUNK_SECONDS / 8);
}

function isBitSet(bitmap: Uint8Array, index: number): boolean {
  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;
  return (bitmap[byteIndex] & (1 << bitIndex)) !== 0;
}

function setBit(bitmap: Uint8Array, index: number): void {
  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;
  bitmap[byteIndex] |= 1 << bitIndex;
}

export function chunkStartMs(timestampMs: number): number {
  return Math.floor(timestampMs / CHUNK_MILLISECONDS) * CHUNK_MILLISECONDS;
}

export function sampleIndexInChunk(timestampMs: number, startMs = chunkStartMs(timestampMs)): number {
  return Math.floor((timestampMs - startMs) / 1000);
}

export function createEmptyChunkBuffers(startMs: number, updatedAtMs = Date.now()): ChunkBuffer {
  return {
    chunkStartMs: startMs,
    samples: new Int16Array(CHUNK_SECONDS),
    validityBitmap: new Uint8Array(bitmapByteLength()),
    updatedAtMs
  };
}

export function setChunkSample(chunk: ChunkBuffer, sample: FrequencySample): void {
  const index = sampleIndexInChunk(sample.timestampMs, chunk.chunkStartMs);
  if (index < 0 || index >= CHUNK_SECONDS) return;
  chunk.samples[index] = encodeFrequencyHz(sample.frequencyHz);
  setBit(chunk.validityBitmap, index);
  chunk.updatedAtMs = Date.now();
}

export function summarizeChunk(chunk: ChunkBuffer): ChunkSummary {
  let sampleCount = 0;
  let minValue: number | null = null;
  let maxValue: number | null = null;
  let sumValue = 0;
  for (let index = 0; index < CHUNK_SECONDS; index += 1) {
    if (!isBitSet(chunk.validityBitmap, index)) continue;
    const value = chunk.samples[index];
    sampleCount += 1;
    minValue = minValue === null ? value : Math.min(minValue, value);
    maxValue = maxValue === null ? value : Math.max(maxValue, value);
    sumValue += value;
  }
  return {
    sampleCount,
    minValue,
    maxValue,
    sumValue: sampleCount ? sumValue : null
  };
}

export function buildChunks(samples: FrequencySample[], updatedAtMs = Date.now()): Map<number, ChunkBuffer> {
  const chunks = new Map<number, ChunkBuffer>();
  for (const sample of samples) {
    const startMs = chunkStartMs(sample.timestampMs);
    let chunk = chunks.get(startMs);
    if (!chunk) {
      chunk = createEmptyChunkBuffers(startMs, updatedAtMs);
      chunks.set(startMs, chunk);
    }
    setChunkSample(chunk, sample);
  }
  return new Map([...chunks.entries()].sort(([a], [b]) => a - b));
}

export function filterSamplesForRetention(samples: FrequencySample[], nowMs = Date.now()): FrequencySample[] {
  const oldestAllowedMs = nowMs - RETENTION_SECONDS * 1000;
  return samples.filter((sample) => sample.timestampMs >= oldestAllowedMs && sample.timestampMs <= nowMs + 60_000);
}

export function nextDelaySecondsForCollectionResult(result: CollectionResult): number {
  if (result.ok) return POLL_INTERVAL_SECONDS;
  if (result.status === 401 || result.status === 403) return 900;
  if (result.status === 408) return POLL_INTERVAL_SECONDS;
  if (result.status === 429) {
    const count = result.consecutiveRateLimitErrors || 1;
    if (count <= 1) return 120;
    if (count === 2) return 300;
    return 600;
  }
  return 300;
}

function toIso(value: number | null): string | null {
  return value === null || !Number.isFinite(value) ? null : new Date(value).toISOString();
}

function rowToChunk(row: FrequencyChunkRow): ChunkBuffer {
  return {
    chunkStartMs: row.chunk_start_ms,
    samples: new Int16Array(row.samples),
    validityBitmap: new Uint8Array(row.validity_bitmap),
    updatedAtMs: row.updated_at_ms
  };
}

export class FrequencyStore implements FrequencyStoreApi {
  private readonly ready: Promise<void>;

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    this.ready = this.state.blockConcurrencyWhile(async () => {
      this.ensureSchema();
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === "/internal/health") return Response.json(await this.getHealth());
    if (url.pathname === "/internal/status") return Response.json(await this.getStatus());
    if (url.pathname === "/internal/minute-series") {
      return Response.json(await this.getMinuteSeries(numberParam(url, "from"), numberParam(url, "to")));
    }
    if (url.pathname === "/internal/raw-series") {
      const fromMs = numberParam(url, "from") ?? Date.now() - 3600_000;
      const toMs = numberParam(url, "to") ?? Date.now();
      return Response.json(await this.getRawSeries(fromMs, toMs));
    }
    if (url.pathname === "/internal/delta") return Response.json(await this.getDelta(numberParam(url, "after") ?? 0));
    if (url.pathname === "/internal/ensure-alarm") {
      await this.ensureAlarm();
      return Response.json({ ok: true });
    }
    if (url.pathname === "/internal/collect") {
      return Response.json(await this.collectOnce());
    }
    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.ready;
    const result = await this.collectOnce();
    await this.scheduleNextAlarm(nextDelaySecondsForCollectionResult(result));
  }

  async getHealth(): Promise<HealthPayload> {
    const status = await this.getStatus();
    return {
      collector: status.status,
      dataAvailable: Boolean(status.latestMeasurementTime)
    };
  }

  async getStatus(): Promise<LiveStatusPayload> {
    await this.ready;
    const now = Date.now();
    const latest = this.latestSample();
    const earliest = this.earliestSample();
    const lastCollectionMs = this.getNumberState("last_collection_ms");
    const authError = this.getStringState("auth_error") === "true";
    const upstreamError = this.getStringState("upstream_error") === "true";
    const raw = await this.getRawSeries(now - RETENTION_SECONDS * 1000, now + 60_000);
    const values = raw.map((sample) => sample.frequencyHz);
    const minFrequencyHz = values.length ? Math.min(...values) : null;
    const maxFrequencyHz = values.length ? Math.max(...values) : null;
    const meanFrequencyHz = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const availableHistorySeconds = latest && earliest ? Math.max(0, Math.floor((latest.timestampMs - earliest.timestampMs) / 1000)) : 0;
    const latestMeasurementMs = latest?.timestampMs ?? null;
    const collectorDelaySeconds = lastCollectionMs ? Math.max(0, Math.floor((now - lastCollectionMs) / 1000)) : null;
    const sourceDelaySeconds = latestMeasurementMs ? Math.max(0, Math.floor((now - latestMeasurementMs) / 1000)) : null;
    const status: LiveStatusPayload["status"] = authError
      ? "auth-error"
      : upstreamError
        ? "upstream-error"
        : latestMeasurementMs === null
          ? "warming"
          : sourceDelaySeconds !== null && sourceDelaySeconds > SOURCE_DELAY_SECONDS + 1800
            ? "stale"
            : "healthy";

    return {
      status,
      source: "GridRadar",
      metric: this.env.GRIDRADAR_METRIC || GRIDRADAR_METRIC,
      nominalFrequencyHz: NOMINAL_FREQUENCY_HZ,
      latestFrequencyHz: latest?.frequencyHz ?? null,
      latestMeasurementTime: toIso(latestMeasurementMs),
      lastCollectionTime: toIso(lastCollectionMs),
      sourceDelaySeconds,
      collectorDelaySeconds,
      resolutionSeconds: 1,
      retentionHours: 24,
      availableHistorySeconds,
      validSampleRatio: Math.min(1, values.length / Math.max(1, availableHistorySeconds || values.length || 1)),
      minFrequencyHz,
      maxFrequencyHz,
      meanFrequencyHz
    };
  }

  async getMinuteSeries(fromMs = Date.now() - RETENTION_SECONDS * 1000, toMs = Date.now()): Promise<MinuteSeriesPoint[]> {
    const raw = await this.getRawSeries(fromMs, toMs);
    const buckets = new Map<number, { sum: number; min: number; max: number; count: number }>();
    for (const sample of raw) {
      const minuteMs = Math.floor(sample.timestampMs / 60_000) * 60_000;
      const bucket = buckets.get(minuteMs) || { sum: 0, min: sample.frequencyHz, max: sample.frequencyHz, count: 0 };
      bucket.sum += sample.frequencyHz;
      bucket.min = Math.min(bucket.min, sample.frequencyHz);
      bucket.max = Math.max(bucket.max, sample.frequencyHz);
      bucket.count += 1;
      buckets.set(minuteMs, bucket);
    }
    return [...buckets.entries()].sort(([a], [b]) => a - b).map(([timestampMs, bucket]) => ({
      timestamp: new Date(timestampMs).toISOString(),
      meanHz: Number((bucket.sum / bucket.count).toFixed(6)),
      minHz: Number(bucket.min.toFixed(6)),
      maxHz: Number(bucket.max.toFixed(6)),
      validSamples: bucket.count
    }));
  }

  async getRawSeries(fromMs: number, toMs: number): Promise<FrequencySample[]> {
    await this.ready;
    const startChunk = chunkStartMs(fromMs);
    const endChunk = chunkStartMs(toMs);
    const rows = this.query<FrequencyChunkRow>(
      "SELECT * FROM frequency_chunks WHERE chunk_start_ms BETWEEN ? AND ? ORDER BY chunk_start_ms",
      startChunk,
      endChunk
    );
    const samples: FrequencySample[] = [];
    for (const row of rows) {
      const chunk = rowToChunk(row);
      for (let index = 0; index < CHUNK_SECONDS; index += 1) {
        if (!isBitSet(chunk.validityBitmap, index)) continue;
        const timestampMs = chunk.chunkStartMs + index * 1000;
        if (timestampMs < fromMs || timestampMs > toMs) continue;
        samples.push({ timestampMs, frequencyHz: decodeFrequencyValue(chunk.samples[index]) });
      }
    }
    return samples;
  }

  async getDelta(afterMs: number): Promise<FrequencySample[]> {
    const now = Date.now();
    const safeAfter = Math.max(afterMs, now - RETENTION_SECONDS * 1000);
    return this.getRawSeries(safeAfter + 1, now + 60_000);
  }

  async ensureAlarm(): Promise<void> {
    const alarm = await this.state.storage.getAlarm();
    if (alarm === null) await this.scheduleNextAlarm(1);
  }

  async collectOnce(): Promise<CollectionResult> {
    await this.ready;
    let result: CollectionResult = { ok: false, status: 0 };
    try {
      result = await fetchGridRadarSamples(this.env);
      const now = Date.now();
      if (!result.ok) {
        this.setState("last_collection_ms", String(now));
        this.setState("auth_error", result.status === 401 || result.status === 403 ? "true" : "false");
        this.setState("upstream_error", result.status && result.status >= 500 ? "true" : "false");
        if (result.status === 429) {
          const current = this.getNumberState("rate_limit_errors") || 0;
          this.setState("rate_limit_errors", String(current + 1));
          result.consecutiveRateLimitErrors = current + 1;
        }
        return result;
      }
      const lastMeasurementMs = this.getNumberState("last_measurement_ms") || 0;
      const samples = filterSamplesForRetention(result.samples || [], now)
        .filter((sample) => sample.timestampMs > lastMeasurementMs)
        .sort((a, b) => a.timestampMs - b.timestampMs);
      if (samples.length) {
        this.upsertSamples(samples);
        this.setState("last_measurement_ms", String(samples.at(-1)!.timestampMs));
      }
      this.deleteExpiredChunks(now);
      this.setState("last_collection_ms", String(now));
      this.setState("auth_error", "false");
      this.setState("upstream_error", "false");
      this.setState("rate_limit_errors", "0");
      return { ...result, samples };
    } finally {
      await this.scheduleNextAlarm(nextDelaySecondsForCollectionResult(result));
    }
  }

  private ensureSchema(): void {
    this.state.storage.sql.exec(`
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
      CREATE TABLE IF NOT EXISTS collector_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
    `);
  }

  private query<T>(sql: string, ...bindings: SqlStorageValue[]): T[] {
    return Array.from(this.state.storage.sql.exec(sql, ...bindings)) as unknown as T[];
  }

  private getStringState(key: string): string | null {
    return this.query<StateRow>("SELECT value FROM collector_state WHERE key = ?", key)[0]?.value ?? null;
  }

  private getNumberState(key: string): number | null {
    const value = Number(this.getStringState(key));
    return Number.isFinite(value) ? value : null;
  }

  private setState(key: string, value: string): void {
    this.state.storage.sql.exec(
      "INSERT INTO collector_state (key, value, updated_at_ms) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at_ms = excluded.updated_at_ms",
      key,
      value,
      Date.now()
    );
  }

  private upsertSamples(samples: FrequencySample[]): void {
    const incoming = buildChunks(samples);
    for (const [startMs, incomingChunk] of incoming) {
      const existingRow = this.query<FrequencyChunkRow>("SELECT * FROM frequency_chunks WHERE chunk_start_ms = ?", startMs)[0];
      const chunk = existingRow ? rowToChunk(existingRow) : incomingChunk;
      if (existingRow) {
        for (const sample of samples.filter((item) => chunkStartMs(item.timestampMs) === startMs)) {
          setChunkSample(chunk, sample);
        }
      }
      const summary = summarizeChunk(chunk);
      this.state.storage.sql.exec(
        `INSERT INTO frequency_chunks
          (chunk_start_ms, samples, validity_bitmap, sample_count, min_value, max_value, sum_value, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(chunk_start_ms) DO UPDATE SET
          samples = excluded.samples,
          validity_bitmap = excluded.validity_bitmap,
          sample_count = excluded.sample_count,
          min_value = excluded.min_value,
          max_value = excluded.max_value,
          sum_value = excluded.sum_value,
          updated_at_ms = excluded.updated_at_ms`,
        startMs,
        cloneArrayBuffer(chunk.samples),
        cloneArrayBuffer(chunk.validityBitmap),
        summary.sampleCount,
        summary.minValue,
        summary.maxValue,
        summary.sumValue,
        Date.now()
      );
    }
  }

  private deleteExpiredChunks(nowMs: number): void {
    const oldestChunk = chunkStartMs(nowMs - RETENTION_SECONDS * 1000);
    this.state.storage.sql.exec("DELETE FROM frequency_chunks WHERE chunk_start_ms < ?", oldestChunk);
  }

  private latestSample(): FrequencySample | null {
    const rows = this.query<FrequencyChunkRow>("SELECT * FROM frequency_chunks ORDER BY chunk_start_ms DESC LIMIT 2");
    for (const row of rows) {
      const chunk = rowToChunk(row);
      for (let index = CHUNK_SECONDS - 1; index >= 0; index -= 1) {
        if (isBitSet(chunk.validityBitmap, index)) {
          return { timestampMs: chunk.chunkStartMs + index * 1000, frequencyHz: decodeFrequencyValue(chunk.samples[index]) };
        }
      }
    }
    return null;
  }

  private earliestSample(): FrequencySample | null {
    const rows = this.query<FrequencyChunkRow>("SELECT * FROM frequency_chunks ORDER BY chunk_start_ms ASC LIMIT 2");
    for (const row of rows) {
      const chunk = rowToChunk(row);
      for (let index = 0; index < CHUNK_SECONDS; index += 1) {
        if (isBitSet(chunk.validityBitmap, index)) {
          return { timestampMs: chunk.chunkStartMs + index * 1000, frequencyHz: decodeFrequencyValue(chunk.samples[index]) };
        }
      }
    }
    return null;
  }

  private async scheduleNextAlarm(delaySeconds: number): Promise<void> {
    await this.state.storage.setAlarm(Date.now() + Math.max(1, delaySeconds) * 1000);
  }
}

function numberParam(url: URL, key: string): number | undefined {
  const value = Number(url.searchParams.get(key));
  return Number.isFinite(value) ? value : undefined;
}
