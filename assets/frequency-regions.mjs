const DEFAULT_NOMINAL_FREQUENCY_HZ = 50;
const DEFAULT_SAMPLE_INTERVAL_SECONDS = 1;

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSample(sample, fallbackDurationSeconds) {
  if (typeof sample === "number") {
    return {
      frequencyHz: finiteNumber(sample),
      durationSeconds: fallbackDurationSeconds,
      valid: Number.isFinite(sample)
    };
  }
  if (!sample || typeof sample !== "object") {
    return { frequencyHz: null, durationSeconds: fallbackDurationSeconds, valid: false };
  }
  const durationSeconds = Math.max(0, finiteNumber(sample.durationSeconds) ?? fallbackDurationSeconds);
  const frequencyHz = finiteNumber(sample.frequencyHz ?? sample.frequency ?? sample.value);
  return {
    frequencyHz,
    durationSeconds,
    valid: sample.valid === false ? false : frequencyHz !== null
  };
}

function confidenceForCoverage(coverageRatio, validDurationSeconds) {
  if (!validDurationSeconds) return "none";
  if (coverageRatio >= 0.98) return "high";
  if (coverageRatio >= 0.8) return "medium";
  return "low";
}

export function calculateElectricalTimeDeviation(samples, options = {}) {
  const nominalFrequencyHz = Math.max(
    0.000001,
    finiteNumber(options.nominalFrequencyHz) ?? DEFAULT_NOMINAL_FREQUENCY_HZ
  );
  const sampleIntervalSeconds = Math.max(
    0,
    finiteNumber(options.sampleIntervalSeconds) ?? DEFAULT_SAMPLE_INTERVAL_SECONDS
  );
  const gapThresholdSeconds = Math.max(0, finiteNumber(options.gapThresholdSeconds) ?? 60);
  const input = Array.from(samples || []);

  let seconds = 0;
  let validSamples = 0;
  let skippedSamples = 0;
  let validDurationSeconds = 0;
  let totalDurationSeconds = 0;
  let hasLargeGap = false;

  for (const rawSample of input) {
    const sample = normalizeSample(rawSample, sampleIntervalSeconds);
    const durationSeconds = sample.durationSeconds;
    totalDurationSeconds += durationSeconds;
    if (durationSeconds > gapThresholdSeconds) hasLargeGap = true;
    if (!sample.valid || sample.frequencyHz === null || durationSeconds <= 0) {
      skippedSamples += 1;
      continue;
    }
    seconds += ((sample.frequencyHz - nominalFrequencyHz) / nominalFrequencyHz) * durationSeconds;
    validDurationSeconds += durationSeconds;
    validSamples += 1;
  }

  const coverageRatio = totalDurationSeconds > 0 ? validDurationSeconds / totalDurationSeconds : 0;
  return {
    seconds: validSamples ? seconds : null,
    validSamples,
    skippedSamples,
    validDurationSeconds,
    totalDurationSeconds,
    coverageRatio,
    hasLargeGap,
    confidence: confidenceForCoverage(coverageRatio, validDurationSeconds)
  };
}

export function formatSignedSeconds(value, digits = 3) {
  const number = finiteNumber(value);
  if (number === null) return "—";
  const sign = number >= 0 ? "+" : "";
  return `${sign}${number.toFixed(digits)} s`;
}

if (typeof window !== "undefined") {
  window.GridFreqRegions = {
    calculateElectricalTimeDeviation,
    formatSignedSeconds
  };
}
