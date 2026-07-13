const DEFAULT_NOMINAL_HZ = 50;

export function createSyntheticSignal({
  seconds = 600,
  sampleRateHz = 1,
  baseHz = DEFAULT_NOMINAL_HZ,
  oscillationHz = 0.12,
  amplitudeMhz = 20,
  phaseRadians = 0,
  delaySeconds = 0,
  noiseMhz = 0,
  gaps = []
} = {}) {
  const count = Math.max(1, Math.round(seconds * sampleRateHz));
  const values = new Float64Array(count);
  const timestamps = new Float64Array(count);
  let seed = 1234567;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff - 0.5) * 2;
  };
  for (let i = 0; i < count; i += 1) {
    const t = i / sampleRateHz;
    timestamps[i] = t;
    const angle = 2 * Math.PI * oscillationHz * (t - delaySeconds) + phaseRadians;
    values[i] = baseHz + (amplitudeMhz / 1000) * Math.sin(angle) + (noiseMhz / 1000) * noise();
  }
  for (const [start, end] of gaps) {
    const from = Math.max(0, Math.round(start * sampleRateHz));
    const to = Math.min(count, Math.round(end * sampleRateHz));
    for (let i = from; i < to; i += 1) values[i] = NaN;
  }
  return { timestamps, values };
}

export function analyzeDataQuality(timestamps, values, { expectedIntervalSeconds = 1 } = {}) {
  const n = values?.length || 0;
  let validCount = 0;
  let invalidCount = 0;
  let duplicateTimestampCount = 0;
  let longestGapSeconds = 0;
  let currentGap = 0;
  let stuckSeconds = 0;
  let currentStuck = 0;
  let jumpCount = 0;
  const seen = new Set();
  const intervals = [];
  let previousTimestamp = null;
  let previousValue = null;
  for (let i = 0; i < n; i += 1) {
    const ts = Number(timestamps?.[i] ?? i * expectedIntervalSeconds);
    if (seen.has(ts)) duplicateTimestampCount += 1;
    seen.add(ts);
    if (previousTimestamp !== null) intervals.push(ts - previousTimestamp);
    previousTimestamp = ts;

    const value = values[i];
    if (Number.isFinite(value)) {
      validCount += 1;
      longestGapSeconds = Math.max(longestGapSeconds, currentGap * expectedIntervalSeconds);
      currentGap = 0;
      if (previousValue !== null && Number.isFinite(previousValue)) {
        if (Math.abs(value - previousValue) > 0.08) jumpCount += 1;
        currentStuck = Math.abs(value - previousValue) < 1e-9 ? currentStuck + expectedIntervalSeconds : 0;
        stuckSeconds = Math.max(stuckSeconds, currentStuck);
      }
      previousValue = value;
    } else {
      invalidCount += 1;
      currentGap += 1;
    }
  }
  longestGapSeconds = Math.max(longestGapSeconds, currentGap * expectedIntervalSeconds);
  const expectedCount = n ? Math.round(((timestamps?.[n - 1] ?? n - 1) - (timestamps?.[0] ?? 0)) / expectedIntervalSeconds) + 1 : 0;
  const missingCount = Math.max(0, expectedCount - validCount);
  const medianInterval = percentile(intervals, 0.5);
  const intervalStd = standardDeviation(intervals);
  const coverageRatio = expectedCount ? validCount / expectedCount : 0;
  return {
    expectedCount,
    actualCount: n,
    validCount,
    coverageRatio,
    missingCount,
    duplicateTimestampCount,
    invalidCount,
    longestGapSeconds,
    shortGapCount: invalidCount && longestGapSeconds < 30 ? 1 : 0,
    stuckSeconds,
    jumpCount,
    firstTimestamp: n ? timestamps?.[0] ?? 0 : null,
    lastTimestamp: n ? timestamps?.[n - 1] ?? n - 1 : null,
    medianIntervalSeconds: medianInterval,
    intervalStdSeconds: intervalStd
  };
}

export function computeBasicStats(values, {
  nominalHz = DEFAULT_NOMINAL_HZ,
  bandMinHz = 49.95,
  bandMaxHz = 50.05
} = {}) {
  const clean = finiteValues(values).sort((a, b) => a - b);
  const n = clean.length;
  if (!n) return emptyStats();
  const mean = clean.reduce((a, b) => a + b, 0) / n;
  const deviations = clean.map(v => v - mean);
  const variance = deviations.reduce((sum, v) => sum + v * v, 0) / n;
  const stdDev = Math.sqrt(variance);
  const nominalDeviations = clean.map(v => v - nominalHz);
  const rmsDeviationMhz = Math.sqrt(nominalDeviations.reduce((sum, v) => sum + v * v, 0) / n) * 1000;
  const meanAbsDeviationMhz = nominalDeviations.reduce((sum, v) => sum + Math.abs(v), 0) / n * 1000;
  const skewness = stdDev > 0 ? deviations.reduce((sum, v) => sum + (v / stdDev) ** 3, 0) / n : 0;
  const kurtosis = stdDev > 0 ? deviations.reduce((sum, v) => sum + (v / stdDev) ** 4, 0) / n - 3 : 0;
  const inBand = clean.filter(v => v >= bandMinHz && v <= bandMaxHz).length;
  const bandEvents = countBandViolationEvents(values, bandMinHz, bandMaxHz);
  const p01 = percentile(clean, 0.01);
  const p05 = percentile(clean, 0.05);
  const p25 = percentile(clean, 0.25);
  const p75 = percentile(clean, 0.75);
  const p95 = percentile(clean, 0.95);
  const p99 = percentile(clean, 0.99);
  return {
    count: n,
    mean,
    median: percentile(clean, 0.5),
    min: clean[0],
    max: clean[n - 1],
    stdDev,
    variance,
    rmsDeviationMhz,
    meanAbsDeviationMhz,
    p01,
    p05,
    p25,
    p75,
    p95,
    p99,
    p01Hz: p01,
    p05Hz: p05,
    p25Hz: p25,
    p75Hz: p75,
    p95Hz: p95,
    p99Hz: p99,
    skewness,
    kurtosis,
    inBandRatio: inBand / n,
    outOfBandSeconds: n - inBand,
    longestBandViolationSeconds: bandEvents.longestSeconds,
    bandViolationEventCount: bandEvents.count
  };
}

export function computeRocof(values, {
  method = "central",
  sampleIntervalSeconds = 1,
  thresholdHzPerSecond = 0.01,
  minEventSeconds = 1
} = {}) {
  const n = values?.length || 0;
  const rocof = new Float64Array(n);
  rocof.fill(NaN);
  for (let i = 0; i < n; i += 1) {
    const prevIndex = method === "simple" ? i - 1 : i - 1;
    const nextIndex = method === "simple" ? i : i + 1;
    if (prevIndex < 0 || nextIndex >= n) continue;
    const a = values[prevIndex];
    const b = values[nextIndex];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const dt = (nextIndex - prevIndex) * sampleIntervalSeconds;
    rocof[i] = (b - a) / dt;
  }
  const clean = finiteValues(rocof);
  const abs = clean.map(Math.abs);
  const events = thresholdEvents(rocof, thresholdHzPerSecond, minEventSeconds);
  return {
    series: rocof,
    method,
    maxPositive: clean.length ? Math.max(...clean) : NaN,
    maxNegative: clean.length ? Math.min(...clean) : NaN,
    meanAbsolute: abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : NaN,
    rms: abs.length ? Math.sqrt(clean.reduce((sum, v) => sum + v * v, 0) / abs.length) : NaN,
    thresholdEventCount: events.length,
    thresholdSeconds: events.reduce((sum, event) => sum + event.durationSeconds, 0),
    events
  };
}

export function estimateDominantFrequency(values, {
  sampleRateHz = 1,
  minHz = 0.01,
  maxHz = 0.5,
  stepHz
} = {}) {
  const clean = detrendedArray(values);
  const n = clean.length;
  const step = stepHz || Math.max(1 / Math.max(1, n), 0.001);
  let best = { frequencyHz: minHz, power: -Infinity };
  const powers = [];
  for (let f = minHz; f <= maxHz + 1e-12; f += step) {
    const coeff = complexAt(clean, f, sampleRateHz);
    const power = coeff.re * coeff.re + coeff.im * coeff.im;
    powers.push(power);
    if (power > best.power) best = { frequencyHz: f, power };
  }
  const sorted = powers.slice().sort((a, b) => a - b);
  const noiseFloor = percentile(sorted, 0.5) || 1e-12;
  return {
    frequencyHz: best.frequencyHz,
    power: best.power,
    noiseFloor,
    snr: best.power / noiseFloor
  };
}

export function computeCrossCorrelation(a, b, { maxLagSeconds = 30 } = {}) {
  let bestLagSeconds = 0;
  let bestCorrelation = -Infinity;
  for (let lag = -maxLagSeconds; lag <= maxLagSeconds; lag += 1) {
    const corr = correlationAtLag(a, b, lag);
    if (Number.isFinite(corr) && corr > bestCorrelation) {
      bestCorrelation = corr;
      bestLagSeconds = lag;
    }
  }
  return {
    bestLagSeconds,
    bestCorrelation,
    classification: bestCorrelation > 0.8 ? "common-mode-indicator" : bestCorrelation < 0.3 ? "uncertain-event" : "local-behavior-indicator"
  };
}

export function estimateCoherence(a, b, { targetHz = 0.12, sampleRateHz = 1 } = {}) {
  const x = detrendedArray(a);
  const y = detrendedArray(b);
  const ax = complexAt(x, targetHz, sampleRateHz);
  const by = complexAt(y, targetHz, sampleRateHz);
  const crossRe = ax.re * by.re + ax.im * by.im;
  const crossIm = ax.im * by.re - ax.re * by.im;
  const crossPower = crossRe * crossRe + crossIm * crossIm;
  const px = ax.re * ax.re + ax.im * ax.im;
  const py = by.re * by.re + by.im * by.im;
  return { frequencyHz: targetHz, coherence: px > 0 && py > 0 ? clamp01(crossPower / (px * py)) : 0 };
}

export function estimatePhaseDifference(a, b, { targetHz = 0.12, sampleRateHz = 1 } = {}) {
  const ax = complexAt(detrendedArray(a), targetHz, sampleRateHz);
  const by = complexAt(detrendedArray(b), targetHz, sampleRateHz);
  const phaseA = Math.atan2(ax.im, ax.re);
  const phaseB = Math.atan2(by.im, by.re);
  return {
    frequencyHz: targetHz,
    phaseRadians: normalizeRadians(phaseB - phaseA),
    phaseDegrees: normalizeDegrees((phaseB - phaseA) * 180 / Math.PI)
  };
}

export function computeOscillationConfidence({
  coverageRatio = 0,
  snr = 0,
  durationSeconds = 0,
  bandEnergyRatio = 0,
  peakProminence = 0,
  simultaneousSources = false,
  coherence = 0,
  hasGaps = false
} = {}) {
  let score = 0;
  score += 22 * clamp01(coverageRatio);
  score += 18 * clamp01(Math.log10(Math.max(1, snr)) / 2);
  score += 14 * clamp01(durationSeconds / 300);
  score += 12 * clamp01(bandEnergyRatio);
  score += 12 * clamp01(peakProminence);
  score += simultaneousSources ? 10 : 0;
  score += 10 * clamp01(coherence);
  if (hasGaps) score -= 15;
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors: { coverageRatio, snr, durationSeconds, bandEnergyRatio, peakProminence, simultaneousSources, coherence, hasGaps }
  };
}

function finiteValues(values) {
  return Array.from(values || []).filter(Number.isFinite);
}

function detrendedArray(values) {
  const clean = finiteValues(values);
  const mean = clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
  return Array.from(values || [], value => Number.isFinite(value) ? value - mean : 0);
}

function percentile(sortedOrValues, p) {
  const values = Array.from(sortedOrValues || []).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return NaN;
  const index = (values.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function standardDeviation(values) {
  const clean = finiteValues(values);
  if (clean.length < 2) return 0;
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  return Math.sqrt(clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / clean.length);
}

function countBandViolationEvents(values, minHz, maxHz) {
  let count = 0;
  let longestSeconds = 0;
  let current = 0;
  let active = false;
  for (const value of values || []) {
    const outside = Number.isFinite(value) && (value < minHz || value > maxHz);
    if (outside) {
      current += 1;
      if (!active) {
        active = true;
        count += 1;
      }
    } else {
      longestSeconds = Math.max(longestSeconds, current);
      current = 0;
      active = false;
    }
  }
  longestSeconds = Math.max(longestSeconds, current);
  return { count, longestSeconds };
}

function thresholdEvents(series, threshold, minEventSeconds) {
  const events = [];
  let start = null;
  let peak = 0;
  for (let i = 0; i <= series.length; i += 1) {
    const value = series[i];
    const over = Number.isFinite(value) && Math.abs(value) >= threshold;
    if (over && start === null) {
      start = i;
      peak = value;
    } else if (over) {
      if (Math.abs(value) > Math.abs(peak)) peak = value;
    } else if (start !== null) {
      const end = i - 1;
      const durationSeconds = end - start + 1;
      if (durationSeconds >= minEventSeconds) events.push({ startSecond: start, endSecond: end, durationSeconds, peakHzPerSecond: peak });
      start = null;
    }
  }
  return events;
}

function correlationAtLag(a, b, lag) {
  const xs = [];
  const ys = [];
  const n = Math.min(a?.length || 0, b?.length || 0);
  for (let i = 0; i < n; i += 1) {
    const j = i + lag;
    if (j < 0 || j >= n) continue;
    const x = a[i];
    const y = b[j];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  if (xs.length < 3) return NaN;
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

function complexAt(values, frequencyHz, sampleRateHz) {
  let re = 0;
  let im = 0;
  for (let i = 0; i < values.length; i += 1) {
    const angle = -2 * Math.PI * frequencyHz * i / sampleRateHz;
    re += values[i] * Math.cos(angle);
    im += values[i] * Math.sin(angle);
  }
  return { re, im };
}

function normalizeRadians(value) {
  let out = value;
  while (out <= -Math.PI) out += 2 * Math.PI;
  while (out > Math.PI) out -= 2 * Math.PI;
  return out;
}

function normalizeDegrees(value) {
  let out = value;
  while (out <= -180) out += 360;
  while (out > 180) out -= 360;
  return out;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function emptyStats() {
  return {
    count: 0,
    mean: NaN,
    median: NaN,
    min: NaN,
    max: NaN,
    stdDev: NaN,
    variance: NaN,
    rmsDeviationMhz: NaN,
    meanAbsDeviationMhz: NaN,
    p01: NaN,
    p05: NaN,
    p25: NaN,
    p75: NaN,
    p95: NaN,
    p99: NaN,
    skewness: NaN,
    kurtosis: NaN,
    inBandRatio: NaN,
    outOfBandSeconds: 0,
    longestBandViolationSeconds: 0,
    bandViolationEventCount: 0
  };
}

export const FrequencyAnalysisCore = {
  analyzeDataQuality,
  computeBasicStats,
  computeCrossCorrelation,
  computeOscillationConfidence,
  computeRocof,
  createSyntheticSignal,
  estimateCoherence,
  estimateDominantFrequency,
  estimatePhaseDifference
};

globalThis.FrequencyAnalysisCore = FrequencyAnalysisCore;
