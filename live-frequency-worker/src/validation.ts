import type { FrequencySample } from "./types";

export function parseTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) return Math.floor(value / 1000) * 1000;
    if (value > 1_000_000_000) return Math.floor(value) * 1000;
    return null;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(value.trim())) {
      return parseTimestampMs(numeric);
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000) * 1000;
  }
  return null;
}

export function parseFrequencyHz(value: unknown): number | null {
  const frequency = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(frequency)) return null;
  if (frequency < 45 || frequency > 55) return null;
  return frequency;
}

export function isValidFrequencySample(sample: FrequencySample): boolean {
  return Number.isInteger(sample.timestampMs) && parseFrequencyHz(sample.frequencyHz) !== null;
}
