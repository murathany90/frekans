export interface Env {
  FREQUENCY_STORE: DurableObjectNamespace;
  GRIDRADAR_TOKEN?: string;
  GRIDRADAR_API_BASE_URL?: string;
  GRIDRADAR_METRIC?: string;
  POLL_INTERVAL_SECONDS?: string;
  RETENTION_SECONDS?: string;
  CHUNK_SECONDS?: string;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
}

export interface FrequencySample {
  timestampMs: number;
  frequencyHz: number;
}

export interface RejectedGridRadarPoint {
  reason: "invalid-json" | "invalid-frequency" | "invalid-timestamp" | "unrecognized-point";
  value: unknown;
}

export interface GridRadarParseResult {
  samples: FrequencySample[];
  rejected: RejectedGridRadarPoint[];
}

export interface CollectionResult {
  ok: boolean;
  status?: number;
  samples?: FrequencySample[];
  consecutiveRateLimitErrors?: number;
  message?: string;
}

export interface HealthPayload {
  collector: "healthy" | "warming" | "stale" | "auth-error" | "upstream-error";
  dataAvailable: boolean;
}

export interface LiveStatusPayload {
  status: "healthy" | "warming" | "stale" | "auth-error" | "upstream-error";
  source: "GridRadar";
  metric: string;
  nominalFrequencyHz: number;
  latestFrequencyHz: number | null;
  latestMeasurementTime: string | null;
  lastCollectionTime: string | null;
  sourceDelaySeconds: number | null;
  collectorDelaySeconds: number | null;
  resolutionSeconds: 1;
  retentionHours: 24;
  availableHistorySeconds: number;
  validSampleRatio: number;
  minFrequencyHz?: number | null;
  maxFrequencyHz?: number | null;
  meanFrequencyHz?: number | null;
}

export interface MinuteSeriesPoint {
  timestamp: string;
  meanHz: number | null;
  minHz: number | null;
  maxHz: number | null;
  validSamples: number;
}

export interface FrequencyStoreApi {
  getHealth(): Promise<HealthPayload>;
  getStatus(): Promise<LiveStatusPayload>;
  getMinuteSeries(fromMs?: number, toMs?: number): Promise<MinuteSeriesPoint[]>;
  getRawSeries(fromMs: number, toMs: number): Promise<FrequencySample[]>;
  getDelta(afterMs: number): Promise<FrequencySample[]>;
}

export interface ChunkBuffer {
  chunkStartMs: number;
  samples: Int16Array;
  validityBitmap: Uint8Array;
  updatedAtMs: number;
}

export interface ChunkSummary {
  sampleCount: number;
  minValue: number | null;
  maxValue: number | null;
  sumValue: number | null;
}
