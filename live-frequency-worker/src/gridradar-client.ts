import { GRIDRADAR_METRIC } from "./constants";
import { parseFrequencyHz, parseTimestampMs } from "./validation";
import type { CollectionResult, Env, FrequencySample, GridRadarParseResult, RejectedGridRadarPoint } from "./types";

function parseInput(input: unknown, rejected: RejectedGridRadarPoint[]): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input) as unknown;
  } catch {
    rejected.push({ reason: "invalid-json", value: input });
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseArrayPoint(value: unknown[]): FrequencySample | null {
  if (value.length < 2) return null;
  const [first, second] = value;
  const firstTimestamp = parseTimestampMs(first);
  const secondTimestamp = parseTimestampMs(second);
  const firstFrequency = parseFrequencyHz(first);
  const secondFrequency = parseFrequencyHz(second);

  if (firstTimestamp !== null && secondFrequency !== null) {
    return { timestampMs: firstTimestamp, frequencyHz: secondFrequency };
  }
  if (secondTimestamp !== null && firstFrequency !== null) {
    return { timestampMs: secondTimestamp, frequencyHz: firstFrequency };
  }
  return null;
}

function parseObjectPoint(value: Record<string, unknown>): FrequencySample | null {
  const timestamp = value.timestamp ?? value.time ?? value.ts ?? value.t;
  const frequency = value.frequencyHz ?? value.frequency ?? value.value ?? value.v;
  const timestampMs = parseTimestampMs(timestamp);
  const frequencyHz = parseFrequencyHz(frequency);
  if (timestampMs === null || frequencyHz === null) return null;
  return { timestampMs, frequencyHz };
}

function pointFailureReason(value: unknown): RejectedGridRadarPoint["reason"] {
  if (Array.isArray(value) && value.length >= 2) {
    const [first, second] = value;
    const hasTimestamp = parseTimestampMs(first) !== null || parseTimestampMs(second) !== null;
    const hasFrequency = parseFrequencyHz(first) !== null || parseFrequencyHz(second) !== null;
    if (!hasTimestamp) return "invalid-timestamp";
    if (!hasFrequency) return "invalid-frequency";
  }
  if (isRecord(value)) {
    const timestamp = value.timestamp ?? value.time ?? value.ts ?? value.t;
    const frequency = value.frequencyHz ?? value.frequency ?? value.value ?? value.v;
    if (parseTimestampMs(timestamp) === null) return "invalid-timestamp";
    if (parseFrequencyHz(frequency) === null) return "invalid-frequency";
  }
  return "unrecognized-point";
}

function collectPoints(value: unknown, out: unknown[]): void {
  if (Array.isArray(value)) {
    if (value.length >= 2 && !Array.isArray(value[0]) && !isRecord(value[0])) {
      out.push(value);
      return;
    }
    value.forEach((item) => collectPoints(item, out));
    return;
  }
  if (!isRecord(value)) return;
  const pointKeys = ["datapoints", "data", "values", "result", "series"];
  if (
    "value" in value ||
    "frequency" in value ||
    "frequencyHz" in value ||
    (("timestamp" in value || "time" in value || "ts" in value) && ("v" in value))
  ) {
    out.push(value);
  }
  for (const key of pointKeys) {
    if (key in value) collectPoints(value[key], out);
  }
}

export function parseGridRadarJson(input: unknown): GridRadarParseResult {
  const rejected: RejectedGridRadarPoint[] = [];
  const payload = parseInput(input, rejected);
  if (payload === null || payload === undefined) return { samples: [], rejected };

  const rawPoints: unknown[] = [];
  collectPoints(payload, rawPoints);

  const bySecond = new Map<number, FrequencySample>();
  for (const point of rawPoints) {
    const sample = Array.isArray(point) ? parseArrayPoint(point) : isRecord(point) ? parseObjectPoint(point) : null;
    if (!sample) {
      rejected.push({ reason: pointFailureReason(point), value: point });
      continue;
    }
    bySecond.set(sample.timestampMs, sample);
  }

  const samples = [...bySecond.values()].sort((a, b) => a.timestampMs - b.timestampMs);
  return { samples, rejected };
}

export async function fetchGridRadarSamples(env: Env, fetcher: typeof fetch = fetch): Promise<CollectionResult> {
  if (!env.GRIDRADAR_TOKEN) {
    return { ok: false, status: 401, message: "missing GRIDRADAR_TOKEN" };
  }
  const baseUrl = env.GRIDRADAR_API_BASE_URL || "https://api.gridradar.net";
  const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GRIDRADAR_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      metric: env.GRIDRADAR_METRIC || GRIDRADAR_METRIC,
      format: "json",
      ts: "rfc3339",
      aggr: "1s"
    })
  });

  if (!response.ok) {
    return { ok: false, status: response.status, message: `GridRadar returned ${response.status}` };
  }

  const text = await response.text();
  const parsed = parseGridRadarJson(text);
  return { ok: true, status: response.status, samples: parsed.samples };
}
