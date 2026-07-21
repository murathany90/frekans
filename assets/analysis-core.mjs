const DEFAULT_NOMINAL_HZ = 50;
const DEFAULT_SAMPLE_RATE_HZ = 1;
const EPSILON = 1e-18;

export const DEFAULT_ROCOF_PARAMETERS = Object.freeze({
  method: "central",
  sampleIntervalSeconds: 1,
  thresholdHzPerSecond: 0.01,
  minEventSeconds: 5,
  preFilterSeconds: 5,
  windowSeconds: 5
});

export const DEFAULT_WELCH_PARAMETERS = Object.freeze({
  sampleRateHz: 1,
  segmentSeconds: 256,
  stepSeconds: 128,
  windowType: "hann",
  detrend: "constant",
  minValidRatio: 0.75,
  scale: "linear",
  averaging: "mean",
  maxPeaks: 5
});

export const DEFAULT_SPECTROGRAM_PARAMETERS = Object.freeze({
  sampleRateHz: 1,
  segmentSeconds: 256,
  stepSeconds: 64,
  windowType: "hann",
  detrend: "constant",
  minValidRatio: 0.75,
  scale: "log"
});

export const DEFAULT_OSCILLATION_PARAMETERS = Object.freeze({
  minFrequencyHz: 0.10,
  maxFrequencyHz: 0.20,
  thresholdMode: "fixed",
  enterThresholdMilliHz: 10,
  exitThresholdMilliHz: 7,
  minimumEventSeconds: 30,
  minimumCycles: 3,
  mergeGapSeconds: 20,
  filterOrder: 100,
  filterPhaseMode: "zero-phase",
  rmsWindowSeconds: 60,
  spectralWindowSeconds: 256,
  spectralStepSeconds: 64,
  minimumSnrDb: 3,
  minimumProminence: 0.02,
  minimumValidRatio: 0.75,
  gapHandlingMethod: "reject",
  dampingEnabled: false,
  dampingMethod: "envelope-regression"
});

const ALLOWED_SPECTRAL_WINDOWS = new Set(["hann", "hamming", "rectangular"]);
const ALLOWED_SPECTRAL_DETRENDS = new Set(["constant", "linear", "none"]);
const ALLOWED_SPECTRAL_SCALES = new Set(["linear", "log"]);
const ALLOWED_SPECTRAL_AVERAGING = new Set(["mean", "median"]);
const ALLOWED_GAP_HANDLING = new Set(["segment-mean", "reject", "short-gap-linear"]);
const ALLOWED_OSCILLATION_THRESHOLD_MODES = new Set(["fixed", "adaptive"]);
const ALLOWED_OSCILLATION_FILTER_PHASE_MODES = new Set(["zero-phase", "centered", "causal"]);
const ALLOWED_OSCILLATION_DAMPING_METHODS = new Set(["envelope-regression", "log-decrement", "damped-sinusoid-fit", "matrix-pencil"]);
const DEFAULT_SPECTROGRAM_MAX_CELLS = 1_500_000;
const DEFAULT_SPECTRAL_PEAK_CLASSIFICATION = Object.freeze({
  significantSnrDb: 6,
  weakSnrDb: 3,
  noiseSnrDb: 0,
  minProminenceRatio: 0.05
});
const DEFAULT_SPECTROGRAM_RIDGE_PARAMETERS = Object.freeze({
  minSnrDb: 6,
  minProminenceRatio: 0.05,
  minDurationSeconds: 180,
  maxFrequencyJumpHz: 0.04,
  minContinuityRatio: 0.6
});

export function mHzPerSecondToHzPerSecond(value) {
  return Number(value) / 1000;
}

export function hzPerSecondToMhzPerSecond(value) {
  return Number(value) * 1000;
}

function finitePositive(value, fallback, minimum = EPSILON) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, numeric) : fallback;
}

function normalizeRocofMethod(method) {
  if (method === "centralDifference") return "central";
  if (method === "filtered" || method === "filteredCentral") return "filteredDerivative";
  if (method === "regression" || method === "slidingRegression") return "movingRegression";
  if (["central", "filteredDerivative", "movingRegression", "simple"].includes(method)) return method;
  return DEFAULT_ROCOF_PARAMETERS.method;
}

function effectiveOddWindowSamples(requestedSeconds, sampleIntervalSeconds, minimumSamples = 1) {
  const dt = Math.max(EPSILON, Number(sampleIntervalSeconds) || DEFAULT_ROCOF_PARAMETERS.sampleIntervalSeconds);
  let samples = Math.max(minimumSamples, Math.round(finitePositive(requestedSeconds, dt, dt) / dt));
  if (samples % 2 === 0) samples += 1;
  return samples;
}

export function normalizeRocofParameters(options = {}) {
  const defaults = DEFAULT_ROCOF_PARAMETERS;
  const method = normalizeRocofMethod(options.method ?? defaults.method);
  const sampleIntervalSeconds = finitePositive(options.sampleIntervalSeconds, defaults.sampleIntervalSeconds);
  const thresholdHzPerSecond = Math.abs(finitePositive(options.thresholdHzPerSecond, defaults.thresholdHzPerSecond, 0));
  const minEventSeconds = finitePositive(options.minEventSeconds, defaults.minEventSeconds, sampleIntervalSeconds);
  const preFilterSeconds = finitePositive(options.preFilterSeconds, defaults.preFilterSeconds, sampleIntervalSeconds);
  const windowSeconds = finitePositive(options.windowSeconds, defaults.windowSeconds, sampleIntervalSeconds);
  const effectivePreFilterSamples = effectiveOddWindowSamples(preFilterSeconds, sampleIntervalSeconds, 1);
  const effectiveWindowSamples = effectiveOddWindowSamples(windowSeconds, sampleIntervalSeconds, 3);
  const hysteresisEnabled = Boolean(options.hysteresisEnabled);
  const enterThresholdHzPerSecond = Math.abs(finitePositive(
    options.enterThresholdHzPerSecond,
    thresholdHzPerSecond,
    0
  ));
  const rawExitThreshold = options.exitThresholdHzPerSecond;
  const exitThresholdHzPerSecond = Math.min(
    enterThresholdHzPerSecond,
    Math.abs(finitePositive(rawExitThreshold, enterThresholdHzPerSecond, 0))
  );
  const mergeGapSeconds = Number.isFinite(Number(options.mergeGapSeconds))
    ? Math.max(0, Number(options.mergeGapSeconds))
    : 0;
  return {
    method,
    sampleIntervalSeconds,
    thresholdHzPerSecond,
    minEventSeconds,
    preFilterSeconds,
    windowSeconds,
    requestedPreFilterSeconds: preFilterSeconds,
    effectivePreFilterSamples,
    effectivePreFilterSeconds: effectivePreFilterSamples * sampleIntervalSeconds,
    requestedWindowSeconds: windowSeconds,
    effectiveWindowSamples,
    effectiveWindowSeconds: effectiveWindowSamples * sampleIntervalSeconds,
    hysteresisEnabled,
    enterThresholdHzPerSecond,
    exitThresholdHzPerSecond,
    mergeGapSeconds
  };
}

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

export function analyzeDataQuality(timestamps, values, {
  expectedIntervalSeconds = 1,
  startSecond = null,
  endSecond = null,
  validMinHz = 49,
  validMaxHz = 51,
  repeatedValueThresholdSeconds = 15,
  stuckThresholdSeconds = null,
  nonFiniteAsMissing = false
} = {}) {
  const n = values?.length || 0;
  const intervalSeconds = Math.max(1e-9, Number(expectedIntervalSeconds) || 1);
  const hasTimestamps = timestamps && timestamps.length;
  const finiteTimestamps = [];
  for (let i = 0; i < n; i += 1) {
    const ts = Number(hasTimestamps ? timestamps[i] : i * intervalSeconds);
    if (Number.isFinite(ts)) finiteTimestamps.push(ts);
  }
  const firstTimestamp = finiteTimestamps.length ? Math.min(...finiteTimestamps) : null;
  const lastTimestamp = finiteTimestamps.length ? Math.max(...finiteTimestamps) : null;
  const hasExplicitStart = startSecond !== null && startSecond !== undefined && Number.isFinite(Number(startSecond));
  const hasExplicitEnd = endSecond !== null && endSecond !== undefined && Number.isFinite(Number(endSecond));
  const windowStart = hasExplicitStart ? Number(startSecond) : (firstTimestamp ?? 0);
  const windowEnd = hasExplicitEnd
    ? Number(endSecond)
    : (lastTimestamp !== null ? lastTimestamp + intervalSeconds : windowStart);
  const expectedCount = Math.max(0, Math.round((windowEnd - windowStart) / intervalSeconds));
  const canonicalValues = new Array(expectedCount).fill(null);
  const observedMask = new Array(expectedCount).fill(false);
  const validMask = new Array(expectedCount).fill(false);
  const invalidMask = new Array(expectedCount).fill(false);
  const duplicateMask = new Array(expectedCount).fill(false);
  const stuckMask = new Array(expectedCount).fill(false);
  const intervals = [];
  const duplicateEvents = [];
  let duplicateTimestampCount = 0;
  let invalidCount = 0;
  let rawValidSampleCount = 0;
  let jumpCount = 0;
  let previousInputTimestamp = null;
  let previousInputValue = null;

  for (let i = 0; i < n; i += 1) {
    const ts = Number(hasTimestamps ? timestamps[i] : windowStart + i * intervalSeconds);
    if (!Number.isFinite(ts)) continue;
    if (previousInputTimestamp !== null) intervals.push(ts - previousInputTimestamp);
    previousInputTimestamp = ts;
    const index = Math.round((ts - windowStart) / intervalSeconds);
    const canonicalSecond = windowStart + index * intervalSeconds;
    if (index < 0 || index >= expectedCount || Math.abs(ts - canonicalSecond) > intervalSeconds / 2) continue;

    const rawValue = values[i];
    const value = Number(rawValue);
    const finiteValue = Number.isFinite(value) && !(typeof rawValue === "string" && rawValue.trim() === "");
    const presentSample = finiteValue || (hasTimestamps && !nonFiniteAsMissing);
    const validValue = finiteValue && value >= validMinHz && value <= validMaxHz;
    const duplicate = observedMask[index];
    if (duplicate) {
      duplicateTimestampCount += 1;
      duplicateMask[index] = true;
      duplicateEvents.push({
        type: "duplicate",
        startSecond: canonicalSecond,
        endSecond: canonicalSecond + intervalSeconds,
        durationSeconds: intervalSeconds,
        classification: "Duplicate Timestamp"
      });
    }
    if (presentSample) {
      observedMask[index] = true;
    }
    if (finiteValue) {
      if (previousInputValue !== null && Number.isFinite(previousInputValue) && Math.abs(value - previousInputValue) > 0.08) jumpCount += 1;
      previousInputValue = value;
    }
    if (validValue) {
      rawValidSampleCount += 1;
      if (!validMask[index]) {
        canonicalValues[index] = value;
        validMask[index] = true;
      }
    } else if (presentSample) {
      invalidCount += 1;
      invalidMask[index] = true;
    }
  }

  const missingEvents = collectMaskEvents(observedMask.map(item => !item), windowStart, intervalSeconds, "missing", "Missing Data");
  const invalidEvents = collectMaskEvents(invalidMask, windowStart, intervalSeconds, "invalid", "Invalid Value");
  const gapEventCount = missingEvents.length;
  const missingCount = missingEvents.reduce((sum, event) => sum + Math.round(event.durationSeconds / intervalSeconds), 0);
  const longestGapSeconds = missingEvents.reduce((max, event) => Math.max(max, event.durationSeconds), 0);

  const repeatedValueEvents = [];
  const thresholdOption = repeatedValueThresholdSeconds ?? stuckThresholdSeconds ?? 15;
  const repeatedThreshold = Math.max(intervalSeconds, Number(thresholdOption) || 15);
  let runStart = -1;
  let runValue = null;
  for (let i = 0; i <= expectedCount; i += 1) {
    const value = i < expectedCount && validMask[i] ? canonicalValues[i] : null;
    const continues = i < expectedCount && runStart >= 0 && value !== null && Math.abs(value - runValue) < 1e-9;
    if (continues) continue;
    if (runStart >= 0) {
      const durationSeconds = (i - runStart) * intervalSeconds;
      if (durationSeconds >= repeatedThreshold) {
        for (let j = runStart; j < i; j += 1) stuckMask[j] = true;
        repeatedValueEvents.push({
          type: "repeated",
          startSecond: windowStart + runStart * intervalSeconds,
          endSecond: windowStart + i * intervalSeconds,
          durationSeconds,
          value: runValue,
          classification: "Bad Quality - Repeated Value"
        });
      }
    }
    if (i < expectedCount && value !== null) {
      runStart = i;
      runValue = value;
    } else {
      runStart = -1;
      runValue = null;
    }
  }

  const uniqueObservedCount = observedMask.reduce((sum, item) => sum + (item ? 1 : 0), 0);
  const uniqueValidCount = validMask.reduce((sum, item) => sum + (item ? 1 : 0), 0);
  const goodMask = validMask.map((valid, index) => Boolean(valid && !invalidMask[index] && !duplicateMask[index] && !stuckMask[index]));
  const goodQualityCount = goodMask.reduce((sum, item) => sum + (item ? 1 : 0), 0);
  const coverageRatio = expectedCount ? Math.min(1, uniqueValidCount / expectedCount) : 0;
  const goodQualityRatio = expectedCount ? Math.min(1, goodQualityCount / expectedCount) : 0;
  const totalRepeatedValueSeconds = repeatedValueEvents.reduce((sum, event) => sum + event.durationSeconds, 0);
  const longestRepeatedValueSeconds = repeatedValueEvents.reduce((max, event) => Math.max(max, event.durationSeconds), 0);
  const qualityEvents = [...missingEvents, ...invalidEvents, ...duplicateEvents, ...repeatedValueEvents]
    .sort((a, b) => a.startSecond - b.startSecond || a.endSecond - b.endSecond);

  return {
    expectedCount,
    actualCount: n,
    observedCount: uniqueObservedCount,
    validCount: uniqueValidCount,
    rawValidSampleCount,
    uniqueValidCount,
    goodQualityCount,
    coverageRatio,
    goodQualityRatio,
    missingCount,
    duplicateTimestampCount,
    invalidCount,
    longestGapSeconds,
    gapEventCount,
    shortGapCount: gapEventCount,
    repeatedValueEventCount: repeatedValueEvents.length,
    totalRepeatedValueSeconds,
    longestRepeatedValueSeconds,
    repeatedValueSeconds: longestRepeatedValueSeconds,
    repeatedValueEvents,
    stuckValueEventCount: repeatedValueEvents.length,
    totalStuckSeconds: totalRepeatedValueSeconds,
    longestStuckSeconds: longestRepeatedValueSeconds,
    stuckSeconds: longestRepeatedValueSeconds,
    jumpCount,
    firstTimestamp,
    lastTimestamp,
    startSecond: windowStart,
    endSecond: windowEnd,
    durationSeconds: Math.max(0, windowEnd - windowStart),
    medianIntervalSeconds: percentile(intervals, 0.5),
    intervalStdSeconds: standardDeviation(intervals),
    missingEvents,
    invalidEvents,
    duplicateEvents,
    stuckEvents: repeatedValueEvents,
    qualityEvents,
    canonical: {
      startSecond: windowStart,
      endSecond: windowEnd,
      intervalSeconds,
      values: canonicalValues
    },
    masks: {
      observed: observedMask,
      valid: validMask,
      invalid: invalidMask,
      duplicate: duplicateMask,
      stuck: stuckMask,
      good: goodMask,
      missing: observedMask.map(item => !item)
    }
  };
}

function collectMaskEvents(mask, startSecond, intervalSeconds, type, classification) {
  const events = [];
  let runStart = -1;
  for (let i = 0; i <= mask.length; i += 1) {
    if (i < mask.length && mask[i]) {
      if (runStart < 0) runStart = i;
      continue;
    }
    if (runStart >= 0) {
      events.push({
        type,
        startSecond: startSecond + runStart * intervalSeconds,
        endSecond: startSecond + i * intervalSeconds,
        durationSeconds: (i - runStart) * intervalSeconds,
        classification
      });
      runStart = -1;
    }
  }
  return events;
}

export function computeBasicStats(values, {
  nominalHz = DEFAULT_NOMINAL_HZ,
  bandMinHz = 49.90,
  bandMaxHz = 50.10
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

export function computeRocof(values, options = {}) {
  const params = normalizeRocofParameters(options);
  const n = values?.length || 0;
  const dt = params.sampleIntervalSeconds;
  const normalizedMethod = params.method;
  const startSecond = Number.isFinite(Number(options.startSecond)) ? Number(options.startSecond) : 0;
  const rocof = new Float64Array(n);
  rocof.fill(NaN);
  const discardReasons = new Array(n).fill(null);
  let originalValidCount = 0;
  for (let i = 0; i < n; i += 1) {
    if (Number.isFinite(values[i])) originalValidCount += 1;
  }

  const markDiscard = (index, reason) => {
    if (index < 0 || index >= n || !Number.isFinite(values[index]) || Number.isFinite(rocof[index])) return;
    discardReasons[index] = reason;
  };

  if (normalizedMethod === "movingRegression") {
    const radius = Math.floor(params.effectiveWindowSamples / 2);
    for (let i = 0; i < n; i += 1) {
      if (i < radius || i >= n - radius) {
        markDiscard(i, "edge");
        continue;
      }
      const from = i - radius;
      const to = i + radius;
      if (!Number.isFinite(values[i])) continue;
      if (!allFinite(values, from, to)) {
        markDiscard(i, "regressionWindow");
        continue;
      }
      let count = 0;
      let sumT = 0;
      let sumY = 0;
      let sumTT = 0;
      let sumTY = 0;
      for (let j = from; j <= to; j += 1) {
        const y = values[j];
        const t = (j - i) * dt;
        count += 1;
        sumT += t;
        sumY += y;
        sumTT += t * t;
        sumTY += t * y;
      }
      const denom = count * sumTT - sumT * sumT;
      if (count >= 3 && Math.abs(denom) > EPSILON) rocof[i] = (count * sumTY - sumT * sumY) / denom;
      else markDiscard(i, "regressionWindow");
    }
  } else {
    const source = normalizedMethod === "filteredDerivative" ? movingAverage(values, params.effectivePreFilterSamples) : values;
    for (let i = 0; i < n; i += 1) {
      const prevIndex = normalizedMethod === "simple" ? i - 1 : i - 1;
      const nextIndex = normalizedMethod === "simple" ? i : i + 1;
      if (prevIndex < 0 || nextIndex >= n) {
        markDiscard(i, "edge");
        continue;
      }
      if (!Number.isFinite(values[i])) continue;
      if (!Number.isFinite(values[prevIndex]) || !Number.isFinite(values[nextIndex])) {
        markDiscard(i, "qualityGap");
        continue;
      }
      const a = source[prevIndex];
      const c = source[i];
      const b = source[nextIndex];
      if (!Number.isFinite(a) || !Number.isFinite(c) || !Number.isFinite(b)) {
        markDiscard(i, normalizedMethod === "filteredDerivative" ? "filterWindow" : "qualityGap");
        continue;
      }
      rocof[i] = (b - a) / ((nextIndex - prevIndex) * dt);
    }
  }

  let calculatedCount = 0;
  let maxPositive = -Infinity;
  let maxNegative = Infinity;
  let sumAbs = 0;
  let sumSquares = 0;
  for (const value of rocof) {
    if (!Number.isFinite(value)) continue;
    calculatedCount += 1;
    if (value > maxPositive) maxPositive = value;
    if (value < maxNegative) maxNegative = value;
    sumAbs += Math.abs(value);
    sumSquares += value * value;
  }
  const edgeDiscardCount = discardReasons.filter(reason => reason === "edge").length;
  const qualityGapDiscardCount = discardReasons.filter(reason => reason === "qualityGap").length;
  const filterWindowDiscardCount = discardReasons.filter(reason => reason === "filterWindow").length;
  const regressionWindowDiscardCount = discardReasons.filter(reason => reason === "regressionWindow").length;
  const methodDiscardCount = edgeDiscardCount + qualityGapDiscardCount + filterWindowDiscardCount + regressionWindowDiscardCount;
  const events = thresholdEvents(rocof, params, values, startSecond);
  return {
    series: rocof,
    method: normalizedMethod,
    sampleIntervalSeconds: dt,
    thresholdHzPerSecond: params.thresholdHzPerSecond,
    minEventSeconds: params.minEventSeconds,
    requestedWindowSeconds: params.requestedWindowSeconds,
    effectiveWindowSamples: params.effectiveWindowSamples,
    effectiveWindowSeconds: params.effectiveWindowSeconds,
    requestedPreFilterSeconds: params.requestedPreFilterSeconds,
    effectivePreFilterSamples: params.effectivePreFilterSamples,
    effectivePreFilterSeconds: params.effectivePreFilterSeconds,
    parameters: { ...params },
    maxPositive: calculatedCount ? maxPositive : NaN,
    maxNegative: calculatedCount ? maxNegative : NaN,
    meanAbsolute: calculatedCount ? sumAbs / calculatedCount : NaN,
    rms: calculatedCount ? Math.sqrt(sumSquares / calculatedCount) : NaN,
    originalValidCount,
    calculatedCount,
    rocofCalculatedCount: calculatedCount,
    rocofSampleCount: calculatedCount,
    edgeDiscardCount,
    qualityGapDiscardCount,
    filterWindowDiscardCount,
    regressionWindowDiscardCount,
    methodDiscardCount,
    thresholdEventCount: events.length,
    thresholdSeconds: events.reduce((sum, event) => sum + event.durationSeconds, 0),
    positiveEventCount: events.filter(event => event.side === "positive").length,
    negativeEventCount: events.filter(event => event.side === "negative").length,
    positiveSeconds: events.filter(event => event.side === "positive").reduce((sum, event) => sum + event.durationSeconds, 0),
    negativeSeconds: events.filter(event => event.side === "negative").reduce((sum, event) => sum + event.durationSeconds, 0),
    events
  };
}

export function computeWelchPsd(values, options = {}) {
  const params = normalizeSpectralOptions(values, options, DEFAULT_WELCH_PARAMETERS, "welch");
  const window = makeWindow(params.windowType, params.effectiveSegmentSamples);
  const windowEnergy = window.reduce((sum, value) => sum + value * value, 0);
  const binCount = Math.floor(params.fftLengthSamples / 2) + 1;
  const accum = new Float64Array(binCount);
  const periodograms = [];
  let segmentCount = 0;
  let imputedSegmentCount = 0;
  let totalImputedSampleCount = 0;
  let acceptedValidRatioSum = 0;
  let minimumAcceptedValidRatio = Infinity;
  const starts = segmentStarts(values?.length || 0, params.effectiveSegmentSamples, params.effectiveStepSamples);

  for (const start of starts) {
    const segment = prepareSegment(values, start, params.effectiveSegmentSamples, params);
    if (!segment.accepted) continue;
    const prepared = new Float64Array(params.fftLengthSamples);
    for (let i = 0; i < segment.values.length; i += 1) prepared[i] = segment.values[i] * window[i];
    const spectrum = fftReal(prepared);
    const periodogram = new Float64Array(binCount);
    for (let k = 0; k < binCount; k += 1) {
      let scale = 1 / (params.sampleRateHz * windowEnergy);
      if (k > 0 && k < params.fftLengthSamples / 2) scale *= 2;
      const power = (spectrum.re[k] * spectrum.re[k] + spectrum.im[k] * spectrum.im[k]) * scale;
      periodogram[k] = power;
      if (params.averaging === "mean") accum[k] += power;
    }
    if (params.averaging === "median") periodograms.push(periodogram);
    if (segment.imputedCount > 0) imputedSegmentCount += 1;
    totalImputedSampleCount += segment.imputedCount;
    acceptedValidRatioSum += segment.validRatio;
    minimumAcceptedValidRatio = Math.min(minimumAcceptedValidRatio, segment.validRatio);
    segmentCount += 1;
  }

  const quality = spectralQualitySummary({
    params,
    candidateSegmentCount: starts.length,
    acceptedSegmentCount: segmentCount,
    imputedSegmentCount,
    totalImputedSampleCount,
    acceptedValidRatioSum,
    minimumAcceptedValidRatio
  });
  if (!segmentCount) return emptyPsd(params, quality);

  const allFrequencies = new Float64Array(binCount);
  const allPsd = new Float64Array(binCount);
  for (let k = 0; k < binCount; k += 1) {
    allFrequencies[k] = k * params.sampleRateHz / params.fftLengthSamples;
    allPsd[k] = params.averaging === "median"
      ? medianColumn(periodograms, k)
      : accum[k] / segmentCount;
  }
  const filtered = filterFrequencyRange(allFrequencies, allPsd, params.minHz, params.maxHz);
  const rawPeaks = findPeaks(filtered.frequencies, filtered.values, params.maxPeaks);
  const noiseFloor = medianWithoutPeakBins(filtered.values, rawPeaks, filtered.frequencies);
  const peakCandidates = enrichSpectralPeaks(rawPeaks, filtered.frequencies, filtered.values, noiseFloor, params);
  const peaks = peakCandidates.filter(peak => peak.peakStatus !== "rejected");
  const bandEnergies = computeBandEnergies(allFrequencies, allPsd, params.bands);
  const firstPeak = peaks[0] || { frequencyHz: NaN, psd: NaN, power: NaN };
  const snrLinear = Number.isFinite(firstPeak.psd) ? firstPeak.psd / Math.max(noiseFloor, EPSILON) : NaN;
  const snrDb = ratioToDb(snrLinear);
  const degreesOfFreedom = segmentCount * 2;
  const effectiveDegreesOfFreedom = effectiveWelchDegreesOfFreedom(segmentCount, params.overlapRatio, params.averaging);
  const totalBandPower = integratePower(allFrequencies, allPsd, params.minHz, params.maxHz);
  const variance = finiteVariance(values);
  const totalPower = integratePower(allFrequencies, allPsd, 0, params.nyquistHz);
  const parsevalErrorRatio = Number.isFinite(variance) && variance > EPSILON
    ? (totalPower - variance) / variance
    : NaN;
  return {
    method: "welch-psd",
    units: "Hz^2/Hz",
    sampleRateHz: params.sampleRateHz,
    segmentLength: params.segmentLength,
    requestedSegmentSeconds: params.requestedSegmentSeconds,
    requestedSegmentSamples: params.requestedSegmentSamples,
    effectiveSegmentSeconds: params.effectiveSegmentSeconds,
    effectiveSegmentSamples: params.effectiveSegmentSamples,
    fftLengthSamples: params.fftLengthSamples,
    requestedStepSeconds: params.requestedStepSeconds,
    effectiveStepSeconds: params.effectiveStepSeconds,
    effectiveStepSamples: params.effectiveStepSamples,
    overlapSamples: params.overlapSamples,
    overlapRatio: params.overlapRatio,
    frequencyResolutionHz: params.frequencyResolutionHz,
    fftBinSpacingHz: params.fftBinSpacingHz,
    effectiveSpectralResolutionHz: params.effectiveSpectralResolutionHz,
    windowEquivalentNoiseBandwidthBins: params.windowEquivalentNoiseBandwidthBins,
    zeroPaddingApplied: params.zeroPaddingApplied,
    nyquistHz: params.nyquistHz,
    adjustmentApplied: params.adjustmentApplied,
    adjustmentReason: params.adjustmentReason,
    adjustmentReasonCodes: params.adjustmentReasonCodes,
    windowType: params.windowType,
    detrend: params.detrend,
    segmentCount,
    candidateSegmentCount: quality.candidateSegmentCount,
    acceptedSegmentCount: quality.acceptedSegmentCount,
    rejectedSegmentCount: quality.rejectedSegmentCount,
    imputedSegmentCount: quality.imputedSegmentCount,
    totalImputedSampleCount: quality.totalImputedSampleCount,
    meanValidRatio: quality.meanValidRatio,
    minimumAcceptedValidRatio: quality.minimumAcceptedValidRatio,
    gapHandlingMethod: quality.gapHandlingMethod,
    frequencies: Array.from(filtered.frequencies),
    psd: Array.from(filtered.values),
    allFrequencies: Array.from(allFrequencies),
    allPsd: Array.from(allPsd),
    peaks,
    peakCandidates,
    bandEnergies,
    noiseFloor,
    snr: snrLinear,
    snrLinear,
    snrDb,
    degreesOfFreedom,
    nominalDegreesOfFreedom: degreesOfFreedom,
    effectiveDegreesOfFreedom,
    confidenceInterval95: spectralConfidenceInterval95(effectiveDegreesOfFreedom, params.averaging),
    totalBandPower,
    parsevalErrorRatio,
    averagingMethod: params.averaging,
    scale: params.scale,
    analysisStartEpochMs: params.analysisStartEpochMs,
    analysisTimezone: params.analysisTimezone,
    dataTimezone: params.dataTimezone,
    displayTimezone: params.displayTimezone,
    utcOffset: params.utcOffset,
    calculationResolutionSeconds: params.calculationResolutionSeconds,
    displaySummaryMode: params.displaySummaryMode,
    frequencyHz: firstPeak.frequencyHz,
    power: firstPeak.psd,
    parameters: { ...params }
  };
}

export function dominantFrequencyScan(values, {
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
  const noiseFloor = percentile(powers, 0.5) || EPSILON;
  return {
    method: "dominant-frequency-scan",
    frequencyHz: best.frequencyHz,
    power: best.power,
    noiseFloor,
    snr: best.power / noiseFloor
  };
}

export function estimateDominantFrequency(values, options = {}) {
  const welch = computeWelchPsd(values, { maxPeaks: 1, ...options });
  return {
    method: "welch-psd",
    frequencyHz: welch.frequencyHz,
    power: welch.power,
    noiseFloor: welch.noiseFloor,
    snr: welch.snr,
    peaks: welch.peaks,
    segmentCount: welch.segmentCount
  };
}

export function computeCrossCorrelation(a, b, {
  maxLagSeconds = 30,
  sampleIntervalSeconds = 1
} = {}) {
  const dt = Math.max(EPSILON, Number(sampleIntervalSeconds) || 1);
  const maxLagSamples = Math.max(0, Math.round(maxLagSeconds / dt));
  const correlations = [];
  let bestPositiveCorrelation = -Infinity;
  let bestPositiveLagSamples = 0;
  let bestNegativeCorrelation = Infinity;
  let bestNegativeLagSamples = 0;
  let bestAbsoluteCorrelation = 0;
  let bestAbsoluteLagSamples = 0;

  for (let lag = -maxLagSamples; lag <= maxLagSamples; lag += 1) {
    const corr = correlationAtLag(a, b, lag);
    if (!Number.isFinite(corr)) continue;
    correlations.push({ lagSamples: lag, lagSeconds: lag * dt, correlation: corr });
    if (corr > bestPositiveCorrelation) {
      bestPositiveCorrelation = corr;
      bestPositiveLagSamples = lag;
    }
    if (corr < bestNegativeCorrelation) {
      bestNegativeCorrelation = corr;
      bestNegativeLagSamples = lag;
    }
    if (Math.abs(corr) > Math.abs(bestAbsoluteCorrelation)) {
      bestAbsoluteCorrelation = corr;
      bestAbsoluteLagSamples = lag;
    }
  }

  const bestCorrelation = Math.abs(bestAbsoluteCorrelation) >= Math.abs(bestPositiveCorrelation)
    ? bestAbsoluteCorrelation
    : bestPositiveCorrelation;
  return {
    sampleIntervalSeconds: dt,
    correlations,
    bestPositiveCorrelation,
    bestPositiveLagSamples,
    bestPositiveLagSeconds: bestPositiveLagSamples * dt,
    bestNegativeCorrelation,
    bestNegativeLagSamples,
    bestNegativeLagSeconds: bestNegativeLagSamples * dt,
    bestAbsoluteCorrelation,
    bestAbsoluteLagSamples,
    bestAbsoluteLagSeconds: bestAbsoluteLagSamples * dt,
    bestCorrelation,
    bestLagSeconds: bestAbsoluteLagSamples * dt,
    classification: Math.abs(bestAbsoluteCorrelation) > 0.8 ? "common-mode-indicator" : Math.abs(bestAbsoluteCorrelation) < 0.3 ? "uncertain-event" : "local-behavior-indicator"
  };
}

export function computeMagnitudeSquaredCoherence(a, b, options = {}) {
  const spectra = computeWelchCrossSpectra(a, b, options);
  const points = [];
  let maxCoherence = -Infinity;
  let maxCoherenceFrequencyHz = NaN;
  let sum = 0;
  let count = 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < spectra.frequencies.length; i += 1) {
    const pxx = spectra.pxx[i];
    const pyy = spectra.pyy[i];
    const pxyRe = spectra.pxyRe[i];
    const pxyIm = spectra.pxyIm[i];
    const coherence = clamp01((pxyRe * pxyRe + pxyIm * pxyIm) / Math.max(EPSILON, pxx * pyy));
    const point = { frequencyHz: spectra.frequencies[i], coherence };
    const weight = Math.sqrt(Math.max(0, pxx * pyy));
    points.push(point);
    sum += coherence;
    count += 1;
    weightedSum += coherence * weight;
    weightTotal += weight;
    if (coherence > maxCoherence) {
      maxCoherence = coherence;
      maxCoherenceFrequencyHz = spectra.frequencies[i];
    }
  }
  const highCoherenceRegions = contiguousRegions(points, point => point.coherence >= 0.7);
  return {
    method: "magnitude-squared-coherence",
    frequencies: points.map(point => point.frequencyHz),
    coherence: points.map(point => point.coherence),
    points,
    maxCoherence: Number.isFinite(maxCoherence) ? maxCoherence : NaN,
    maxCoherenceFrequencyHz,
    bandAverageCoherence: weightTotal > EPSILON ? weightedSum / weightTotal : count ? sum / count : NaN,
    bandMaxCoherence: Number.isFinite(maxCoherence) ? maxCoherence : NaN,
    highCoherenceRegions,
    segmentCount: spectra.segmentCount,
    confidence: spectra.segmentCount >= 4 ? "medium" : "low",
    parameters: spectra.parameters
  };
}

export function estimateCoherence(a, b, { targetHz = 0.12, ...options } = {}) {
  const result = computeMagnitudeSquaredCoherence(a, b, {
    targetHz,
    minHz: Math.max(0, targetHz - 0.03),
    maxHz: targetHz + 0.03,
    ...options
  });
  const nearest = nearestPoint(result.points, targetHz, "coherence");
  return {
    method: "magnitude-squared-coherence",
    frequencyHz: nearest?.frequencyHz ?? targetHz,
    coherence: nearest?.coherence ?? 0,
    segmentCount: result.segmentCount
  };
}

export function computeCrossPowerSpectralDensity(a, b, options = {}) {
  const targetHz = options.targetHz ?? ((options.minHz ?? 0.01) + (options.maxHz ?? 0.5)) / 2;
  const spectra = computeWelchCrossSpectra(a, b, options);
  const magnitudes = [];
  const phases = [];
  const coherenceValues = [];
  for (let i = 0; i < spectra.frequencies.length; i += 1) {
    const re = spectra.pxyRe[i];
    const im = spectra.pxyIm[i];
    magnitudes.push(Math.hypot(re, im));
    phases.push(Math.atan2(im, re));
    coherenceValues.push(clamp01((re * re + im * im) / Math.max(EPSILON, spectra.pxx[i] * spectra.pyy[i])));
  }
  const unwrapped = unwrapPhase(phases);
  const selectedIndex = nearestIndex(spectra.frequencies, targetHz);
  const selectedCoherence = coherenceValues[selectedIndex] ?? 0;
  const highMask = coherenceValues.map(value => value >= 0.45);
  const phaseStability = circularStability(phases.filter((_, index) => highMask[index]));
  return {
    method: "cross-power-spectral-density",
    units: "Hz^2/Hz",
    frequencies: Array.from(spectra.frequencies),
    crossPsdMagnitude: magnitudes,
    phaseRadians: phases,
    phaseDegrees: phases.map(value => normalizeDegrees(value * 180 / Math.PI)),
    unwrappedPhaseRadians: unwrapped,
    selectedFrequencyHz: spectra.frequencies[selectedIndex] ?? targetHz,
    selectedMagnitude: magnitudes[selectedIndex] ?? NaN,
    selectedPhaseRadians: phases[selectedIndex] ?? NaN,
    selectedPhaseDegrees: normalizeDegrees((phases[selectedIndex] ?? NaN) * 180 / Math.PI),
    selectedCoherence,
    bandAveragePhaseRadians: circularMean(phases.filter((_, index) => highMask[index])),
    phaseStability,
    phaseConfidence: selectedCoherence >= 0.7 ? "high" : selectedCoherence >= 0.4 ? "medium" : "low",
    segmentCount: spectra.segmentCount,
    parameters: spectra.parameters
  };
}

export function estimatePhaseDifference(a, b, { targetHz = 0.12, ...options } = {}) {
  const cross = computeCrossPowerSpectralDensity(a, b, {
    targetHz,
    minHz: Math.max(0, targetHz - 0.03),
    maxHz: targetHz + 0.03,
    ...options
  });
  return {
    method: "cross-power-spectral-density",
    frequencyHz: cross.selectedFrequencyHz,
    phaseRadians: normalizeRadians(cross.selectedPhaseRadians),
    phaseDegrees: normalizeDegrees(cross.selectedPhaseDegrees),
    confidence: cross.phaseConfidence,
    coherence: cross.selectedCoherence
  };
}

export function computeStftSpectrogram(values, options = {}) {
  const params = normalizeSpectralOptions(values, options, DEFAULT_SPECTROGRAM_PARAMETERS, "spectrogram");
  const window = makeWindow(params.windowType, params.effectiveSegmentSamples);
  const windowEnergy = window.reduce((sum, value) => sum + value * value, 0);
  const binCount = Math.floor(params.fftLengthSamples / 2) + 1;
  const allFrequencies = new Float64Array(binCount);
  for (let k = 0; k < binCount; k += 1) allFrequencies[k] = k * params.sampleRateHz / params.fftLengthSamples;
  const frequencyIndices = [];
  const frequencyBinArray = [];
  for (let k = 0; k < binCount; k += 1) {
    if (allFrequencies[k] >= params.minHz - 1e-12 && allFrequencies[k] <= params.maxHz + 1e-12) {
      frequencyIndices.push(k);
      frequencyBinArray.push(allFrequencies[k]);
    }
  }
  if (!frequencyIndices.length) throw new Error("No frequency bins remain in the requested minHz/maxHz range.");
  const starts = segmentStarts(values?.length || 0, params.effectiveSegmentSamples, params.effectiveStepSamples);
  const estimatedCellCount = starts.length * frequencyIndices.length;
  const estimatedBytes = estimatedCellCount * Float32Array.BYTES_PER_ELEMENT
    + starts.length * (Float64Array.BYTES_PER_ELEMENT + 2 * Float32Array.BYTES_PER_ELEMENT)
    + frequencyIndices.length * Float64Array.BYTES_PER_ELEMENT;
  if (estimatedCellCount > params.maxCells) {
    throw new Error(`Spectrogram cell limit exceeded: ${estimatedCellCount} cells would be produced. Use a shorter period, larger stepSeconds, or narrower frequency range.`);
  }

  const rowCount = starts.length;
  const columnCount = frequencyIndices.length;
  const timeBins = new Float64Array(rowCount);
  const frequencyBins = new Float64Array(frequencyBinArray);
  const powerValues = new Float32Array(rowCount * columnCount);
  powerValues.fill(NaN);
  const validityByTime = new Float32Array(rowCount);
  const imputedSamplesByTime = new Uint32Array(rowCount);
  const powerMatrix = [];
  const peaksByTime = [];
  const ridgePoints = [];
  let acceptedSegmentCount = 0;
  let imputedSegmentCount = 0;
  let totalImputedSampleCount = 0;
  let acceptedValidRatioSum = 0;
  let minimumAcceptedValidRatio = Infinity;
  for (let rowIndex = 0; rowIndex < starts.length; rowIndex += 1) {
    const start = starts[rowIndex];
    const time = (start + params.effectiveSegmentSamples / 2) / params.sampleRateHz;
    timeBins[rowIndex] = time;
    const segment = prepareSegment(values, start, params.effectiveSegmentSamples, params);
    validityByTime[rowIndex] = segment.validRatio;
    imputedSamplesByTime[rowIndex] = segment.imputedCount;
    if (!segment.accepted) {
      powerMatrix.push(Array.from({ length: columnCount }, () => NaN));
      const rejectedPeak = {
        timeSeconds: time,
        frequencyHz: NaN,
        power: NaN,
        powerLinear: NaN,
        psdLevelDb: NaN,
        snrLinear: NaN,
        snrDb: NaN,
        peakProminence: NaN,
        validRatio: segment.validRatio,
        imputedCount: segment.imputedCount,
        accepted: false,
        significant: false,
        rejectedReason: segment.rejectedReason
      };
      peaksByTime.push(rejectedPeak);
      ridgePoints.push(rejectedPeak);
      continue;
    }
    const prepared = new Float64Array(params.fftLengthSamples);
    for (let i = 0; i < segment.values.length; i += 1) prepared[i] = segment.values[i] * window[i];
    const spectrum = fftReal(prepared);
    const row = [];
    const linearPowers = [];
    let best = { frequencyHz: NaN, power: -Infinity, powerLinear: -Infinity, columnIndex: -1 };
    for (let columnIndex = 0; columnIndex < frequencyIndices.length; columnIndex += 1) {
      const k = frequencyIndices[columnIndex];
      let scale = 1 / (params.sampleRateHz * windowEnergy);
      if (k > 0 && k < params.fftLengthSamples / 2) scale *= 2;
      const linearPower = (spectrum.re[k] * spectrum.re[k] + spectrum.im[k] * spectrum.im[k]) * scale;
      const power = params.scale === "log" ? 10 * Math.log10(Math.max(linearPower, EPSILON)) : linearPower;
      linearPowers.push(linearPower);
      powerValues[rowIndex * columnCount + columnIndex] = power;
      row.push(power);
      if (linearPower > best.powerLinear) best = { frequencyHz: allFrequencies[k], power, powerLinear: linearPower, columnIndex };
    }
    const rowNoiseFloor = percentile(linearPowers, 0.5) || EPSILON;
    const rowSnrLinear = best.powerLinear / Math.max(rowNoiseFloor, EPSILON);
    const rowSnrDb = ratioToDb(rowSnrLinear);
    const rowPeakProminence = best.powerLinear - rowNoiseFloor;
    const significant = isSignificantSpectrogramPeak({ snrDb: rowSnrDb, peakProminence: rowPeakProminence, noiseFloor: rowNoiseFloor }, params);
    const enrichedPeak = {
      timeSeconds: time,
      frequencyHz: best.frequencyHz,
      power: best.power,
      powerLinear: best.powerLinear,
      psdLevelDb: powerToDb(best.powerLinear),
      snrLinear: rowSnrLinear,
      snrDb: rowSnrDb,
      peakProminence: rowPeakProminence,
      validRatio: segment.validRatio,
      imputedCount: segment.imputedCount,
      accepted: true,
      significant,
      columnIndex: best.columnIndex
    };
    powerMatrix.push(row);
    peaksByTime.push(enrichedPeak);
    ridgePoints.push(enrichedPeak);
    acceptedSegmentCount += 1;
    if (segment.imputedCount > 0) imputedSegmentCount += 1;
    totalImputedSampleCount += segment.imputedCount;
    acceptedValidRatioSum += segment.validRatio;
    minimumAcceptedValidRatio = Math.min(minimumAcceptedValidRatio, segment.validRatio);
  }
  const quality = spectralQualitySummary({
    params,
    candidateSegmentCount: starts.length,
    acceptedSegmentCount,
    imputedSegmentCount,
    totalImputedSampleCount,
    acceptedValidRatioSum,
    minimumAcceptedValidRatio
  });

  const timeBinsSeconds = Float64Array.from(timeBins);
  const timeBinsEpochMs = new Float64Array(rowCount);
  if (Number.isFinite(params.analysisStartEpochMs)) {
    for (let index = 0; index < rowCount; index += 1) {
      timeBinsEpochMs[index] = params.analysisStartEpochMs + timeBinsSeconds[index] * 1000;
    }
  } else {
    timeBinsEpochMs.fill(NaN);
  }
  const timeFrequencyRegions = buildSpectrogramRegions(ridgePoints, params);

  return {
    method: "stft-spectrogram",
    units: params.scale === "log" ? "dB re 1 Hz²/Hz" : "Hz^2/Hz",
    timeBins,
    timeBinsSeconds,
    timeBinsEpochMs,
    frequencyBins,
    powerValues,
    rowCount,
    columnCount,
    powerMatrix,
    peaksByTime,
    ridgePoints,
    timeFrequencyRegions,
    segmentLength: params.segmentLength,
    requestedSegmentSeconds: params.requestedSegmentSeconds,
    requestedSegmentSamples: params.requestedSegmentSamples,
    effectiveSegmentSeconds: params.effectiveSegmentSeconds,
    effectiveSegmentSamples: params.effectiveSegmentSamples,
    fftLengthSamples: params.fftLengthSamples,
    requestedStepSeconds: params.requestedStepSeconds,
    effectiveStepSeconds: params.effectiveStepSeconds,
    effectiveStepSamples: params.effectiveStepSamples,
    overlapSamples: params.overlapSamples,
    overlapRatio: params.overlapRatio,
    frequencyResolutionHz: params.frequencyResolutionHz,
    fftBinSpacingHz: params.fftBinSpacingHz,
    effectiveSpectralResolutionHz: params.effectiveSpectralResolutionHz,
    windowEquivalentNoiseBandwidthBins: params.windowEquivalentNoiseBandwidthBins,
    zeroPaddingApplied: params.zeroPaddingApplied,
    nyquistHz: params.nyquistHz,
    adjustmentApplied: params.adjustmentApplied,
    adjustmentReason: params.adjustmentReason,
    adjustmentReasonCodes: params.adjustmentReasonCodes,
    windowType: params.windowType,
    detrend: params.detrend,
    sampleRateHz: params.sampleRateHz,
    scale: params.scale,
    minValidRatio: params.minValidRatio,
    minHz: params.minHz,
    maxHz: params.maxHz,
    stepSamples: params.effectiveStepSamples,
    stepSeconds: params.effectiveStepSeconds,
    timeResolutionSeconds: params.effectiveStepSeconds,
    analysisStartEpochMs: params.analysisStartEpochMs,
    analysisTimezone: params.analysisTimezone,
    dataTimezone: params.dataTimezone,
    displayTimezone: params.displayTimezone,
    utcOffset: params.utcOffset,
    calculationResolutionSeconds: params.calculationResolutionSeconds,
    displaySummaryMode: params.displaySummaryMode,
    timeBinReference: "window-center",
    invalidWindowCount: quality.rejectedSegmentCount,
    imputedWindowCount: quality.imputedSegmentCount,
    validityByTime,
    imputedSamplesByTime,
    candidateSegmentCount: quality.candidateSegmentCount,
    acceptedSegmentCount: quality.acceptedSegmentCount,
    rejectedSegmentCount: quality.rejectedSegmentCount,
    imputedSegmentCount: quality.imputedSegmentCount,
    totalImputedSampleCount: quality.totalImputedSampleCount,
    meanValidRatio: quality.meanValidRatio,
    minimumAcceptedValidRatio: quality.minimumAcceptedValidRatio,
    gapHandlingMethod: quality.gapHandlingMethod,
    estimatedCellCount,
    estimatedBytes,
    adaptiveReductionApplied: false,
    parameters: { ...params }
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
  score += 24 * clamp01(coverageRatio);
  score += 20 * clamp01(Math.log10(Math.max(1, snr)) / 2);
  score += 16 * clamp01(durationSeconds / 300);
  score += 14 * clamp01(bandEnergyRatio);
  score += 12 * clamp01(peakProminence);
  score += simultaneousSources ? 8 : 0;
  score += 6 * clamp01(coherence);
  if (hasGaps) score -= 15;
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors: { coverageRatio, snr, durationSeconds, bandEnergyRatio, peakProminence, simultaneousSources, coherence, hasGaps }
  };
}

export function normalizeOscillationParameters(options = {}, length = 0) {
  const defaults = DEFAULT_OSCILLATION_PARAMETERS;
  const sampleRateHz = finitePositive(options.sampleRateHz, DEFAULT_SAMPLE_RATE_HZ);
  const sampleIntervalSeconds = finitePositive(options.sampleIntervalSeconds, 1 / sampleRateHz);
  const nyquistHz = sampleRateHz / 2;
  const minFrequencyHz = Number(options.minFrequencyHz ?? options.bandMin ?? defaults.minFrequencyHz);
  const maxFrequencyHz = Number(options.maxFrequencyHz ?? options.bandMax ?? defaults.maxFrequencyHz);
  if (!Number.isFinite(minFrequencyHz) || !Number.isFinite(maxFrequencyHz) || minFrequencyHz <= 0 || minFrequencyHz >= maxFrequencyHz) {
    throw new Error("Invalid oscillation frequency band: expected 0 < minFrequencyHz < maxFrequencyHz.");
  }
  if (maxFrequencyHz >= nyquistHz - 1e-12) {
    throw new Error(`Invalid oscillation maxFrequencyHz: expected maxFrequencyHz below Nyquist (${nyquistHz} Hz).`);
  }
  const thresholdMode = String(options.thresholdMode ?? defaults.thresholdMode).toLowerCase();
  if (!ALLOWED_OSCILLATION_THRESHOLD_MODES.has(thresholdMode)) {
    throw new Error("Invalid oscillation thresholdMode: expected fixed or adaptive.");
  }
  const requestedEnter = Number(options.enterThresholdMilliHz ?? options.thresholdMhz ?? options.thresholdMilliHz ?? defaults.enterThresholdMilliHz);
  const requestedExit = Number(options.exitThresholdMilliHz ?? Math.min(requestedEnter, defaults.exitThresholdMilliHz));
  const minimumEventSeconds = finitePositive(options.minimumEventSeconds ?? options.minDuration ?? defaults.minimumEventSeconds, defaults.minimumEventSeconds, sampleIntervalSeconds);
  const minimumCycles = finitePositive(options.minimumCycles ?? defaults.minimumCycles, defaults.minimumCycles, 0);
  const mergeGapSeconds = Number.isFinite(Number(options.mergeGapSeconds))
    ? Math.max(0, Number(options.mergeGapSeconds))
    : defaults.mergeGapSeconds;
  const requestedFilterOrder = Math.round(Number(options.filterOrder ?? (
    options.filterTaps !== undefined ? Number(options.filterTaps) - 1 : defaults.filterOrder
  )));
  let effectiveFilterOrder = Math.max(2, Number.isFinite(requestedFilterOrder) ? requestedFilterOrder : defaults.filterOrder);
  if (effectiveFilterOrder % 2 !== 0) effectiveFilterOrder += 1;
  const maxOrderFromData = length ? Math.max(2, Math.min(effectiveFilterOrder, Math.max(2, Math.floor((length - 1) / 2) * 2))) : effectiveFilterOrder;
  const adjustedForLength = maxOrderFromData !== effectiveFilterOrder;
  effectiveFilterOrder = maxOrderFromData;
  const filterTapCount = effectiveFilterOrder + 1;
  const filterPhaseMode = String(options.filterPhaseMode ?? defaults.filterPhaseMode).toLowerCase();
  if (!ALLOWED_OSCILLATION_FILTER_PHASE_MODES.has(filterPhaseMode)) {
    throw new Error("Invalid oscillation filterPhaseMode: expected zero-phase, centered, or causal.");
  }
  const groupDelaySeconds = effectiveFilterOrder / (2 * sampleRateHz);
  const edgeDiscardSeconds = filterPhaseMode === "causal" ? groupDelaySeconds : groupDelaySeconds;
  const rmsWindowSeconds = finitePositive(options.rmsWindowSeconds ?? options.windowSec ?? defaults.rmsWindowSeconds, defaults.rmsWindowSeconds, sampleIntervalSeconds);
  const spectralWindowSeconds = finitePositive(options.spectralWindowSeconds ?? options.windowSec ?? defaults.spectralWindowSeconds, defaults.spectralWindowSeconds, sampleIntervalSeconds * 8);
  const spectralStepSeconds = finitePositive(options.spectralStepSeconds ?? options.stepSec ?? defaults.spectralStepSeconds, defaults.spectralStepSeconds, sampleIntervalSeconds);
  const effectiveRmsWindowSamples = Math.max(1, Math.round(rmsWindowSeconds * sampleRateHz));
  const effectiveSpectralWindowSamples = Math.max(8, Math.round(spectralWindowSeconds * sampleRateHz));
  const effectiveSpectralStepSamples = Math.max(1, Math.min(effectiveSpectralWindowSamples, Math.round(spectralStepSeconds * sampleRateHz)));
  const minimumSnrDb = Number(options.minimumSnrDb ?? defaults.minimumSnrDb);
  const minimumProminence = Number(options.minimumProminence ?? defaults.minimumProminence);
  const minimumValidRatio = Number(options.minimumValidRatio ?? defaults.minimumValidRatio);
  if (!Number.isFinite(minimumValidRatio) || minimumValidRatio < 0 || minimumValidRatio > 1) {
    throw new Error("Invalid oscillation minimumValidRatio: expected 0 <= minimumValidRatio <= 1.");
  }
  const gapHandlingMethod = String(options.gapHandlingMethod ?? defaults.gapHandlingMethod).toLowerCase();
  if (!ALLOWED_GAP_HANDLING.has(gapHandlingMethod)) {
    throw new Error("Invalid oscillation gapHandlingMethod: expected reject, segment-mean, or short-gap-linear.");
  }
  const dampingMethod = String(options.dampingMethod ?? defaults.dampingMethod).toLowerCase();
  if (!ALLOWED_OSCILLATION_DAMPING_METHODS.has(dampingMethod)) {
    throw new Error("Invalid oscillation dampingMethod.");
  }
  const adjustmentReasons = [];
  if (requestedFilterOrder !== effectiveFilterOrder) adjustmentReasons.push("filter-order-adjusted-to-even-safe-length");
  if (adjustedForLength) adjustmentReasons.push("filter-order-limited-by-data-length");
  if (effectiveSpectralStepSamples !== Math.round(spectralStepSeconds * sampleRateHz)) adjustmentReasons.push("spectral-step-limited-to-window");
  const enterThresholdMilliHz = Math.max(0, Number.isFinite(requestedEnter) ? requestedEnter : defaults.enterThresholdMilliHz);
  const exitThresholdMilliHz = Math.max(0, Math.min(
    enterThresholdMilliHz,
    Number.isFinite(requestedExit) ? requestedExit : defaults.exitThresholdMilliHz
  ));
  return {
    ...defaults,
    sampleRateHz,
    sampleIntervalSeconds,
    nyquistHz,
    nominalHz: Number.isFinite(Number(options.nominalHz)) ? Number(options.nominalHz) : DEFAULT_NOMINAL_HZ,
    minFrequencyHz,
    maxFrequencyHz,
    thresholdMode,
    enterThresholdMilliHz,
    exitThresholdMilliHz,
    requestedEnterThresholdMilliHz: enterThresholdMilliHz,
    requestedExitThresholdMilliHz: exitThresholdMilliHz,
    minimumEventSeconds,
    minimumCycles,
    mergeGapSeconds,
    requestedFilterOrder,
    effectiveFilterOrder,
    filterTapCount,
    filterPhaseMode,
    groupDelaySeconds,
    edgeDiscardSeconds,
    requestedWindowSeconds: rmsWindowSeconds,
    effectiveWindowSeconds: effectiveRmsWindowSamples / sampleRateHz,
    effectiveWindowSamples: effectiveRmsWindowSamples,
    rmsWindowSeconds,
    rmsWindowSamples: effectiveRmsWindowSamples,
    spectralWindowSeconds,
    spectralStepSeconds,
    effectiveSpectralWindowSeconds: effectiveSpectralWindowSamples / sampleRateHz,
    effectiveSpectralWindowSamples,
    effectiveSpectralStepSeconds: effectiveSpectralStepSamples / sampleRateHz,
    effectiveSpectralStepSamples,
    minimumSnrDb: Number.isFinite(minimumSnrDb) ? minimumSnrDb : defaults.minimumSnrDb,
    minimumProminence: Number.isFinite(minimumProminence) ? minimumProminence : defaults.minimumProminence,
    minimumValidRatio,
    gapHandlingMethod,
    maxInterpolationGapSamples: Math.max(1, Math.round(Number(options.maxInterpolationGapSamples ?? 2))),
    dampingEnabled: Boolean(options.dampingEnabled ?? defaults.dampingEnabled),
    dampingMethod,
    adjustmentApplied: adjustmentReasons.length > 0,
    adjustmentReason: adjustmentReasons.join("; ") || "none",
    adjustmentReasonCodes: adjustmentReasons
  };
}

export function computeOscillationCandidates(series, options = {}) {
  const input = ArrayBuffer.isView(series) ? Float64Array.from(series) : Float64Array.from(series || []);
  const params = normalizeOscillationParameters(options, input.length);
  if (input.length < Math.max(params.filterTapCount + 8, Math.round(params.minimumEventSeconds * params.sampleRateHz))) {
    throw new Error("Data too short for oscillation candidate detection.");
  }
  const deviation = normalizeOscillationSeries(input, params.nominalHz);
  const validMask = new Uint8Array(deviation.length);
  let originalValidCount = 0;
  for (let i = 0; i < deviation.length; i += 1) {
    if (Number.isFinite(deviation[i])) {
      validMask[i] = 1;
      originalValidCount += 1;
    }
  }
  const coeffs = oscillationBandpassFir(params.minFrequencyHz, params.maxFrequencyHz, params.filterTapCount, params.sampleRateHz);
  const filtered = applyOscillationFir(deviation, coeffs, params);
  const envelopeMhz = oscillationEnvelope(filtered, params);
  const adaptiveThreshold = oscillationAdaptiveThreshold(envelopeMhz);
  const enterThresholdMilliHz = params.thresholdMode === "adaptive"
    ? Math.max(params.enterThresholdMilliHz, adaptiveThreshold.enterThresholdMilliHz)
    : params.enterThresholdMilliHz;
  const exitThresholdMilliHz = params.thresholdMode === "adaptive"
    ? Math.min(enterThresholdMilliHz, Math.max(params.exitThresholdMilliHz, adaptiveThreshold.exitThresholdMilliHz))
    : params.exitThresholdMilliHz;
  const thresholded = detectOscillationRegions(envelopeMhz, validMask, {
    ...params,
    enterThresholdMilliHz,
    exitThresholdMilliHz
  });
  const mergedRegions = mergeOscillationRegions(thresholded.regions, validMask, params);
  const candidates = [];
  const rejectedCandidates = [];
  for (const region of mergedRegions) {
    const candidate = buildOscillationCandidate(region, deviation, filtered, envelopeMhz, validMask, {
      ...params,
      enterThresholdMilliHz,
      exitThresholdMilliHz
    });
    if (
      candidate.durationSeconds + EPSILON >= params.minimumEventSeconds
      && candidate.cycleCount + EPSILON >= params.minimumCycles
      && candidate.snrDb + EPSILON >= params.minimumSnrDb
      && candidate.peakProminenceRatio + EPSILON >= params.minimumProminence
      && candidate.dataQuality.validRatio + EPSILON >= params.minimumValidRatio
    ) {
      candidates.push(candidate);
    } else {
      candidate.rejectedReason = [
        candidate.durationSeconds + EPSILON < params.minimumEventSeconds ? "minimum-duration" : "",
        candidate.cycleCount + EPSILON < params.minimumCycles ? "minimum-cycles" : "",
        candidate.snrDb + EPSILON < params.minimumSnrDb ? "minimum-snr" : "",
        candidate.peakProminenceRatio + EPSILON < params.minimumProminence ? "minimum-prominence" : "",
        candidate.dataQuality.validRatio + EPSILON < params.minimumValidRatio ? "minimum-valid-ratio" : ""
      ].filter(Boolean).join(",");
      rejectedCandidates.push(candidate);
    }
  }
  candidates.sort((a, b) => b.confidenceScore - a.confidenceScore || a.startSecond - b.startSecond);
  candidates.forEach((candidate, index) => {
    candidate.rank = index + 1;
    candidate.no = index + 1;
  });
  const calculatedCount = countFinite(filtered);
  const edgeDiscardCount = Math.min(deviation.length, Math.round(params.edgeDiscardSeconds * params.sampleRateHz) * 2);
  const qualityGapDiscardCount = Math.max(0, originalValidCount - calculatedCount - edgeDiscardCount);
  return {
    method: "oscillation-candidates",
    sampleRateHz: params.sampleRateHz,
    sampleIntervalSeconds: params.sampleIntervalSeconds,
    units: "Hz deviation, mHz amplitude",
    filtered,
    filteredSeries: filtered,
    envelopeMilliHz: envelopeMhz,
    positiveEnvelopeMilliHz: envelopeMhz,
    negativeEnvelopeMilliHz: Float64Array.from(envelopeMhz, value => Number.isFinite(value) ? -value : NaN),
    enterThresholdMilliHz,
    exitThresholdMilliHz,
    thresholdMilliHz: enterThresholdMilliHz,
    thresholdMode: params.thresholdMode,
    candidates,
    events: candidates,
    rejectedCandidates,
    rejectedCandidateCount: rejectedCandidates.length,
    candidateCount: candidates.length,
    originalValidCount,
    calculatedCount,
    edgeDiscardCount,
    qualityGapDiscardCount,
    filterWindowDiscardCount: qualityGapDiscardCount,
    regressionWindowDiscardCount: 0,
    methodDiscardCount: Math.max(0, input.length - calculatedCount),
    missingCount: input.length - originalValidCount,
    dataQuality: {
      totalSamples: input.length,
      originalValidCount,
      calculatedCount,
      missingCount: input.length - originalValidCount,
      edgeDiscardCount,
      qualityGapDiscardCount
    },
    parameters: {
      ...params,
      enterThresholdMilliHz,
      exitThresholdMilliHz,
      adaptiveThreshold,
      requestedFilterOrder: params.requestedFilterOrder,
      effectiveFilterOrder: params.effectiveFilterOrder,
      filterTapCount: params.filterTapCount,
      groupDelaySeconds: params.groupDelaySeconds,
      edgeDiscardSeconds: params.edgeDiscardSeconds,
      requestedWindowSeconds: params.requestedWindowSeconds,
      effectiveWindowSeconds: params.effectiveWindowSeconds,
      adjustmentReason: params.adjustmentReason
    },
    meta: {
      taps: params.filterTapCount,
      filterTapCount: params.filterTapCount,
      requestedFilterOrder: params.requestedFilterOrder,
      effectiveFilterOrder: params.effectiveFilterOrder,
      groupDelaySeconds: params.groupDelaySeconds,
      edgeDiscardSeconds: params.edgeDiscardSeconds,
      windowSec: params.rmsWindowSeconds,
      stepSec: params.spectralStepSeconds,
      threshold: enterThresholdMilliHz,
      exitThreshold: exitThresholdMilliHz,
      f1: params.minFrequencyHz,
      f2: params.maxFrequencyHz,
      requestedWindowSeconds: params.requestedWindowSeconds,
      effectiveWindowSeconds: params.effectiveWindowSeconds,
      adjustmentReason: params.adjustmentReason
    }
  };
}

function normalizeOscillationSeries(values, nominalHz) {
  const finite = [];
  for (const value of values || []) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) finite.push(numeric);
  }
  const center = percentile(finite, 0.5);
  const looksLikeFrequency = Number.isFinite(center) && Math.abs(center - nominalHz) < 5;
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]);
    out[i] = Number.isFinite(value) ? value - (looksLikeFrequency ? nominalHz : 0) : NaN;
  }
  return out;
}

function oscillationBandpassFir(f1, f2, taps, sampleRateHz) {
  const h = new Float64Array(taps);
  const mid = (taps - 1) / 2;
  for (let n = 0; n < taps; n += 1) {
    const m = n - mid;
    const high = m === 0 ? 2 * f2 / sampleRateHz : Math.sin(2 * Math.PI * f2 * m / sampleRateHz) / (Math.PI * m);
    const low = m === 0 ? 2 * f1 / sampleRateHz : Math.sin(2 * Math.PI * f1 * m / sampleRateHz) / (Math.PI * m);
    const hamming = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / Math.max(1, taps - 1));
    h[n] = (high - low) * hamming;
  }
  return h;
}

function applyOscillationFir(data, coeffs, params) {
  const n = data.length;
  const taps = coeffs.length;
  const half = (taps - 1) >> 1;
  const out = new Float64Array(n);
  out.fill(NaN);
  const invalidPrefix = new Uint32Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    invalidPrefix[i + 1] = invalidPrefix[i] + (Number.isFinite(data[i]) ? 0 : 1);
  }
  const first = params.filterPhaseMode === "causal" ? taps - 1 : half;
  const last = params.filterPhaseMode === "causal" ? n : n - half;
  for (let i = first; i < last; i += 1) {
    const left = params.filterPhaseMode === "causal" ? i - taps + 1 : i - half;
    const right = left + taps;
    if (left < 0 || right > n) continue;
    if (invalidPrefix[right] - invalidPrefix[left] > 0) continue;
    let acc = 0;
    for (let k = 0; k < taps; k += 1) acc += data[left + k] * coeffs[k];
    out[i] = acc;
  }
  return out;
}

function oscillationEnvelope(filtered, params) {
  const n = filtered.length;
  const out = new Float64Array(n);
  out.fill(NaN);
  const periodSamples = Math.max(3, Math.round(params.sampleRateHz / Math.max(params.minFrequencyHz, EPSILON)));
  const windowSamples = Math.max(3, Math.min(Math.round(params.rmsWindowSamples || periodSamples), Math.round(periodSamples * 2)));
  const radius = Math.floor(windowSamples / 2);
  const prefixSum = new Float64Array(n + 1);
  const prefixCount = new Uint32Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    const value = filtered[i];
    prefixSum[i + 1] = prefixSum[i] + (Number.isFinite(value) ? Math.abs(value) * 1000 : 0);
    prefixCount[i + 1] = prefixCount[i] + (Number.isFinite(value) ? 1 : 0);
  }
  for (let i = 0; i < n; i += 1) {
    const left = Math.max(0, i - radius);
    const right = Math.min(n, i + radius + 1);
    const count = prefixCount[right] - prefixCount[left];
    if (count < Math.max(1, Math.ceil((right - left) * 0.7))) continue;
    out[i] = (prefixSum[right] - prefixSum[left]) / count * Math.PI / 2;
  }
  return out;
}

function oscillationAdaptiveThreshold(envelopeMhz) {
  const clean = [];
  for (const value of envelopeMhz || []) {
    if (Number.isFinite(value)) clean.push(value);
  }
  const medianValue = percentile(clean, 0.5);
  const deviations = clean.map(value => Math.abs(value - medianValue));
  const mad = percentile(deviations, 0.5);
  const sigma = 1.4826 * (mad || 0);
  return {
    medianMilliHz: medianValue,
    madMilliHz: mad,
    enterThresholdMilliHz: (Number.isFinite(medianValue) ? medianValue : 0) + 4 * sigma,
    exitThresholdMilliHz: (Number.isFinite(medianValue) ? medianValue : 0) + 2 * sigma
  };
}

function detectOscillationRegions(envelopeMhz, validMask, params) {
  const regions = [];
  let current = null;
  const close = endIndex => {
    if (!current) return;
    current.endIndex = Math.max(current.startIndex, endIndex);
    regions.push(current);
    current = null;
  };
  for (let i = 0; i < envelopeMhz.length; i += 1) {
    const valid = Boolean(validMask[i]) && Number.isFinite(envelopeMhz[i]);
    if (!valid) {
      close(i - 1);
      continue;
    }
    const value = envelopeMhz[i];
    if (!current) {
      if (value > params.enterThresholdMilliHz) {
        current = { startIndex: i, endIndex: i, peakEnvelopeMilliHz: value };
      }
    } else if (value >= params.exitThresholdMilliHz) {
      current.endIndex = i;
      current.peakEnvelopeMilliHz = Math.max(current.peakEnvelopeMilliHz, value);
    } else {
      close(i - 1);
    }
  }
  close(envelopeMhz.length - 1);
  return { regions };
}

function mergeOscillationRegions(regions, validMask, params) {
  if (!regions.length) return [];
  const out = [];
  let current = { ...regions[0] };
  for (let index = 1; index < regions.length; index += 1) {
    const next = regions[index];
    const gapSamples = next.startIndex - current.endIndex - 1;
    const gapSeconds = gapSamples / params.sampleRateHz;
    if (gapSeconds <= params.mergeGapSeconds && gapHasOnlyFiniteQuality(validMask, current.endIndex + 1, next.startIndex)) {
      current.endIndex = next.endIndex;
      current.peakEnvelopeMilliHz = Math.max(current.peakEnvelopeMilliHz, next.peakEnvelopeMilliHz);
    } else {
      out.push(current);
      current = { ...next };
    }
  }
  out.push(current);
  return out;
}

function gapHasOnlyFiniteQuality(validMask, start, endExclusive) {
  for (let i = Math.max(0, start); i < Math.min(validMask.length, endExclusive); i += 1) {
    if (!validMask[i]) return false;
  }
  return true;
}

function buildOscillationCandidate(region, deviation, filtered, envelopeMhz, validMask, params) {
  const start = region.startIndex;
  const end = region.endIndex;
  const sampleIntervalSeconds = params.sampleIntervalSeconds;
  const segment = filtered.slice(start, end + 1);
  const envelopeSegment = envelopeMhz.slice(start, end + 1);
  const dominant = dominantFrequencyScan(segment, {
    sampleRateHz: params.sampleRateHz,
    minHz: params.minFrequencyHz,
    maxHz: params.maxFrequencyHz,
    stepHz: Math.max(0.001, 1 / Math.max(16, segment.length * 2))
  });
  const durationSeconds = (end - start + 1) * sampleIntervalSeconds;
  const finiteFiltered = finiteArray(segment);
  const finiteEnvelope = finiteArray(envelopeSegment);
  const peakAmplitudeMhz = maxArrayFinite(finiteEnvelope);
  const peakRmsMhz = rmsFinite(finiteFiltered) * 1000;
  const snrLinear = dominant.snr;
  const snrDb = ratioToDb(snrLinear);
  const noiseFloor = dominant.noiseFloor;
  const peakProminence = Math.max(0, dominant.power - noiseFloor);
  const peakProminenceRatio = peakProminence / Math.max(Math.abs(dominant.power), EPSILON);
  const supportDurationSeconds = oscillationRawSupportSeconds(deviation, start, end, params.exitThresholdMilliHz, params.sampleIntervalSeconds);
  const cycleCount = Math.min(durationSeconds, supportDurationSeconds || durationSeconds) * dominant.frequencyHz;
  const ridge = oscillationRidge(filtered, start, end, params);
  const envelopeFit = fitLogEnvelope(envelopeMhz, start, end, params);
  const dataQuality = oscillationCandidateQuality(validMask, start, end);
  const harmonics = oscillationHarmonics(filtered, start, end, dominant.frequencyHz, params);
  const candidateType = classifyOscillationCandidate({
    durationSeconds,
    supportDurationSeconds,
    cycleCount,
    snrDb,
    ridge,
    envelopeFit,
    harmonics,
    eventCoverageRatio: durationSeconds / Math.max(sampleIntervalSeconds, filtered.length * sampleIntervalSeconds),
    peakAmplitudeMhz,
    thresholdMilliHz: params.enterThresholdMilliHz
  });
  const confidenceComponents = oscillationConfidenceComponents({
    dataQuality,
    snrDb,
    durationSeconds,
    bandEnergyRatio: Math.min(1, Math.max(0, peakProminenceRatio)),
    peakProminenceRatio,
    simultaneousSources: Boolean(params.simultaneousSources),
    coherence: Number(params.coherence || 0),
    hasGaps: dataQuality.missingCount > 0,
    candidateType
  });
  const confidenceScore = Math.max(0, Math.min(100, Math.round(Object.values(confidenceComponents).reduce((sum, value) => sum + value, 0))));
  const damping = estimateOscillationDamping({
    candidateType,
    envelopeFit,
    ridge,
    dominantHz: dominant.frequencyHz,
    durationSeconds,
    cycleCount,
    snrDb,
    dataQuality,
    params
  });
  return {
    start: start * sampleIntervalSeconds,
    end: end * sampleIntervalSeconds,
    startSecond: start * sampleIntervalSeconds,
    endSecond: end * sampleIntervalSeconds,
    durationSeconds,
    peakAmplitudeMhz,
    peakRmsMhz,
    rmsAmplitudeMhz: peakRmsMhz,
    dominantHz: dominant.frequencyHz,
    dominantFrequencyHz: dominant.frequencyHz,
    periodSeconds: dominant.frequencyHz > 0 ? 1 / dominant.frequencyHz : Infinity,
    windows: Math.max(1, ridge.windowCount),
    snr: snrLinear,
    snrLinear,
    snrDb,
    noiseFloor,
    peakProminence,
    peakProminenceRatio,
    bandEnergyRatio: Math.min(1, Math.max(0, peakProminenceRatio)),
    cycleCount,
    minimumCycles: params.minimumCycles,
    minimumCyclesSatisfied: cycleCount + EPSILON >= params.minimumCycles,
    candidateType,
    classification: candidateType,
    confidenceScore,
    confidence: confidenceScore,
    confidenceComponents,
    confidenceFactors: confidenceComponents,
    dataQuality,
    ridge,
    harmonics,
    damping,
    filter: {
      requestedFilterOrder: params.requestedFilterOrder,
      effectiveFilterOrder: params.effectiveFilterOrder,
      filterTapCount: params.filterTapCount,
      filterPhaseMode: params.filterPhaseMode,
      groupDelaySeconds: params.groupDelaySeconds,
      edgeDiscardSeconds: params.edgeDiscardSeconds
    },
    windowsMetadata: {
      requestedWindowSeconds: params.requestedWindowSeconds,
      effectiveWindowSeconds: params.effectiveWindowSeconds,
      spectralWindowSeconds: params.spectralWindowSeconds,
      spectralStepSeconds: params.spectralStepSeconds
    }
  };
}

function oscillationRawSupportSeconds(deviation, start, end, exitThresholdMilliHz, sampleIntervalSeconds) {
  let count = 0;
  const thresholdHz = Math.max(0, Number(exitThresholdMilliHz) || 0) / 1000;
  for (let i = start; i <= end; i += 1) {
    const value = deviation[i];
    if (Number.isFinite(value) && Math.abs(value) > thresholdHz) count += 1;
  }
  return count * sampleIntervalSeconds;
}

function oscillationCandidateQuality(validMask, start, end) {
  let validCount = 0;
  let missingCount = 0;
  for (let i = start; i <= end; i += 1) {
    if (validMask[i]) validCount += 1;
    else missingCount += 1;
  }
  const total = Math.max(0, end - start + 1);
  return {
    totalSamples: total,
    validCount,
    missingCount,
    imputedCount: 0,
    validRatio: total ? validCount / total : 0,
    gapHandlingMethod: "reject"
  };
}

function oscillationRidge(filtered, start, end, params) {
  const points = [];
  const frequencies = [];
  const step = Math.max(1, params.effectiveSpectralStepSamples);
  const length = Math.max(8, Math.min(params.effectiveSpectralWindowSamples, end - start + 1));
  for (let cursor = start; cursor + length - 1 <= end; cursor += step) {
    const segment = filtered.slice(cursor, cursor + length);
    const dominant = dominantFrequencyScan(segment, {
      sampleRateHz: params.sampleRateHz,
      minHz: params.minFrequencyHz,
      maxHz: params.maxFrequencyHz,
      stepHz: Math.max(0.001, 1 / Math.max(16, length * 2))
    });
    const snrDb = ratioToDb(dominant.snr);
    if (Number.isFinite(dominant.frequencyHz)) frequencies.push(dominant.frequencyHz);
    points.push({
      timeSecond: (cursor + length / 2) * params.sampleIntervalSeconds,
      frequencyHz: dominant.frequencyHz,
      snrDb,
      significant: snrDb >= params.minimumSnrDb
    });
  }
  if (!points.length) {
    const dominant = dominantFrequencyScan(filtered.slice(start, end + 1), {
      sampleRateHz: params.sampleRateHz,
      minHz: params.minFrequencyHz,
      maxHz: params.maxFrequencyHz
    });
    frequencies.push(dominant.frequencyHz);
    points.push({ timeSecond: (start + end) * params.sampleIntervalSeconds / 2, frequencyHz: dominant.frequencyHz, snrDb: ratioToDb(dominant.snr), significant: true });
  }
  const minFrequencyHz = minArrayFinite(frequencies);
  const maxFrequencyHz = maxArrayFinite(frequencies);
  const continuityRatio = points.length ? points.filter(point => point.significant).length / points.length : 0;
  return {
    points,
    windowCount: points.length,
    continuityRatio,
    minFrequencyHz,
    maxFrequencyHz,
    medianFrequencyHz: percentile(frequencies, 0.5),
    frequencyDriftHz: Number.isFinite(maxFrequencyHz) && Number.isFinite(minFrequencyHz) ? maxFrequencyHz - minFrequencyHz : 0,
    stable: !(Number.isFinite(maxFrequencyHz) && Number.isFinite(minFrequencyHz)) || maxFrequencyHz - minFrequencyHz <= Math.max(0.015, (params.maxFrequencyHz - params.minFrequencyHz) * 0.25)
  };
}

function oscillationHarmonics(filtered, start, end, dominantHz, params) {
  const out = [];
  if (!Number.isFinite(dominantHz) || dominantHz <= 0) return out;
  for (let factor = 2; factor <= 3; factor += 1) {
    const target = dominantHz * factor;
    if (target >= params.maxFrequencyHz || target >= params.nyquistHz) continue;
    const scan = dominantFrequencyScan(filtered.slice(start, end + 1), {
      sampleRateHz: params.sampleRateHz,
      minHz: Math.max(params.minFrequencyHz, target - 0.01),
      maxHz: Math.min(params.maxFrequencyHz, target + 0.01),
      stepHz: 0.001
    });
    out.push({ harmonic: factor, targetFrequencyHz: target, detectedFrequencyHz: scan.frequencyHz, snrDb: ratioToDb(scan.snr) });
  }
  return out;
}

function classifyOscillationCandidate({ durationSeconds, cycleCount, snrDb, ridge, envelopeFit, harmonics, eventCoverageRatio, peakAmplitudeMhz, thresholdMilliHz }) {
  if (ridge.frequencyDriftHz > Math.max(0.02, Math.abs(ridge.medianFrequencyHz || 0) * 0.2)) return "frequency_drifting";
  if (cycleCount < 3 || snrDb < 0) return "indeterminate";
  if (envelopeFit.fitR2 >= 0.35 && envelopeFit.slopePerSecond < -0.0012) return "ringdown";
  if (envelopeFit.fitR2 >= 0.25 && envelopeFit.slopePerSecond > 0.0012) return "growing";
  if (durationSeconds < 120 || eventCoverageRatio < 0.25 || peakAmplitudeMhz > thresholdMilliHz * 3.5 && durationSeconds < 240) return "burst";
  if (ridge.stable && ridge.continuityRatio >= 0.55 && snrDb >= 3) return "sustained_forced";
  if ((harmonics || []).some(item => item.snrDb >= snrDb - 3)) return "indeterminate";
  return "indeterminate";
}

function oscillationConfidenceComponents({
  dataQuality,
  snrDb,
  durationSeconds,
  bandEnergyRatio,
  peakProminenceRatio,
  simultaneousSources,
  coherence,
  hasGaps,
  candidateType
}) {
  const coverageContribution = 24 * clamp01(dataQuality.validRatio);
  const snrContribution = 20 * clamp01((snrDb + 3) / 18);
  const durationContribution = 16 * clamp01(durationSeconds / 300);
  const bandEnergyContribution = 14 * clamp01(bandEnergyRatio);
  const prominenceContribution = 12 * clamp01(peakProminenceRatio * 4);
  const simultaneousSourceContribution = simultaneousSources ? 8 : 0;
  const coherenceContribution = 6 * clamp01(coherence);
  const gapPenalty = hasGaps ? -15 : 0;
  const typePenalty = candidateType === "indeterminate" ? -8 : 0;
  return {
    coverageContribution,
    snrContribution,
    durationContribution,
    bandEnergyContribution,
    prominenceContribution,
    simultaneousSourceContribution,
    coherenceContribution,
    gapPenalty,
    typePenalty
  };
}

function estimateOscillationDamping({ candidateType, envelopeFit, ridge, dominantHz, durationSeconds, cycleCount, snrDb, dataQuality, params }) {
  const base = {
    dampedFrequencyHz: dominantHz,
    dampingConstantPerSecond: NaN,
    dampingRatio: NaN,
    dampingRatioPercent: NaN,
    timeConstantSeconds: NaN,
    halfLifeSeconds: NaN,
    fitR2: envelopeFit.fitR2,
    fitNrmse: envelopeFit.fitNrmse,
    fittedCycleCount: cycleCount,
    dampingMethod: params.dampingMethod,
    dampingStatus: "unavailable",
    dampingUnavailableReason: ""
  };
  if (!params.dampingEnabled) return { ...base, dampingUnavailableReason: "damping-disabled" };
  if (candidateType === "sustained_forced") return { ...base, dampingUnavailableReason: "continuous-forced-candidate" };
  if (candidateType !== "ringdown" && candidateType !== "growing") return { ...base, dampingUnavailableReason: "candidate-type-not-modal" };
  if (cycleCount < 3) return { ...base, dampingUnavailableReason: "minimum-three-cycles-not-met" };
  if (snrDb < params.minimumSnrDb) return { ...base, dampingUnavailableReason: "insufficient-snr" };
  if (dataQuality.validRatio < params.minimumValidRatio) return { ...base, dampingUnavailableReason: "high-missing-data" };
  if (!ridge.stable) return { ...base, dampingUnavailableReason: "frequency-unstable" };
  if (!Number.isFinite(envelopeFit.slopePerSecond) || envelopeFit.fitR2 < 0.2) {
    return { ...base, dampingUnavailableReason: "insufficient-fit-quality" };
  }
  const sigma = envelopeFit.slopePerSecond;
  const omega = 2 * Math.PI * Math.max(EPSILON, dominantHz);
  const dampingRatio = -sigma / Math.sqrt(omega * omega + sigma * sigma);
  return {
    ...base,
    dampingConstantPerSecond: sigma,
    dampingRatio,
    dampingRatioPercent: dampingRatio * 100,
    timeConstantSeconds: Math.abs(sigma) > EPSILON ? 1 / Math.abs(sigma) : Infinity,
    halfLifeSeconds: Math.abs(sigma) > EPSILON ? Math.log(2) / Math.abs(sigma) : Infinity,
    fitR2: envelopeFit.fitR2,
    fitNrmse: envelopeFit.fitNrmse,
    fittedCycleCount: cycleCount,
    dampingStatus: "available",
    dampingUnavailableReason: ""
  };
}

function fitLogEnvelope(envelopeMhz, start, end, params) {
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  const points = [];
  for (let i = start; i <= end; i += 1) {
    const value = envelopeMhz[i];
    if (!Number.isFinite(value) || value <= EPSILON) continue;
    const x = (i - start) * params.sampleIntervalSeconds;
    const y = Math.log(value);
    points.push({ x, y });
    n += 1;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }
  const denom = n * sumXX - sumX * sumX;
  if (n < 3 || Math.abs(denom) < EPSILON) {
    return { slopePerSecond: NaN, intercept: NaN, fitR2: 0, fitNrmse: NaN, pointCount: n };
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  let rmse = 0;
  for (const point of points) {
    const predicted = intercept + slope * point.x;
    const residual = point.y - predicted;
    ssRes += residual * residual;
    ssTot += (point.y - meanY) * (point.y - meanY);
    rmse += residual * residual;
  }
  const fitR2 = ssTot > EPSILON ? Math.max(0, 1 - ssRes / ssTot) : 0;
  const fitNrmse = Math.sqrt(rmse / n) / Math.max(EPSILON, Math.abs(meanY));
  return { slopePerSecond: slope, intercept, fitR2, fitNrmse, pointCount: n };
}

function finiteArray(values) {
  const out = [];
  for (const value of values || []) {
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

function countFinite(values) {
  let count = 0;
  for (const value of values || []) {
    if (Number.isFinite(value)) count += 1;
  }
  return count;
}

function rmsFinite(values) {
  let sum = 0;
  let count = 0;
  for (const value of values || []) {
    if (!Number.isFinite(value)) continue;
    sum += value * value;
    count += 1;
  }
  return count ? Math.sqrt(sum / count) : NaN;
}

function computeWelchCrossSpectra(a, b, options = {}) {
  const n = Math.min(a?.length || 0, b?.length || 0);
  const params = normalizeSpectralOptions({ length: n }, options, DEFAULT_WELCH_PARAMETERS, "welch");
  const window = makeWindow(params.windowType, params.effectiveSegmentSamples);
  const windowEnergy = window.reduce((sum, value) => sum + value * value, 0);
  const binCount = Math.floor(params.fftLengthSamples / 2) + 1;
  const pxxAll = new Float64Array(binCount);
  const pyyAll = new Float64Array(binCount);
  const pxyReAll = new Float64Array(binCount);
  const pxyImAll = new Float64Array(binCount);
  let segmentCount = 0;

  for (const start of segmentStarts(n, params.effectiveSegmentSamples, params.effectiveStepSamples)) {
    const xSegment = prepareSegment(a, start, params.effectiveSegmentSamples, params);
    const ySegment = prepareSegment(b, start, params.effectiveSegmentSamples, params);
    if (!xSegment.accepted || !ySegment.accepted) continue;
    const x = new Float64Array(params.fftLengthSamples);
    const y = new Float64Array(params.fftLengthSamples);
    for (let i = 0; i < params.effectiveSegmentSamples; i += 1) {
      x[i] = xSegment.values[i] * window[i];
      y[i] = ySegment.values[i] * window[i];
    }
    const sx = fftReal(x);
    const sy = fftReal(y);
    for (let k = 0; k < binCount; k += 1) {
      let scale = 1 / (params.sampleRateHz * windowEnergy);
      if (k > 0 && k < params.fftLengthSamples / 2) scale *= 2;
      const xr = sx.re[k];
      const xi = sx.im[k];
      const yr = sy.re[k];
      const yi = sy.im[k];
      pxxAll[k] += (xr * xr + xi * xi) * scale;
      pyyAll[k] += (yr * yr + yi * yi) * scale;
      pxyReAll[k] += (xr * yr + xi * yi) * scale;
      pxyImAll[k] += (xi * yr - xr * yi) * scale;
    }
    segmentCount += 1;
  }

  if (!segmentCount) {
    return {
      frequencies: [],
      pxx: [],
      pyy: [],
      pxyRe: [],
      pxyIm: [],
      segmentCount: 0,
      parameters: params
    };
  }

  const allFrequencies = new Float64Array(binCount);
  const pxx = [];
  const pyy = [];
  const pxyRe = [];
  const pxyIm = [];
  const frequencies = [];
  for (let k = 0; k < binCount; k += 1) {
    const f = k * params.sampleRateHz / params.fftLengthSamples;
    allFrequencies[k] = f;
    if (f < params.minHz - 1e-12 || f > params.maxHz + 1e-12) continue;
    frequencies.push(f);
    pxx.push(pxxAll[k] / segmentCount);
    pyy.push(pyyAll[k] / segmentCount);
    pxyRe.push(pxyReAll[k] / segmentCount);
    pxyIm.push(pxyImAll[k] / segmentCount);
  }

  return {
    frequencies,
    pxx,
    pyy,
    pxyRe,
    pxyIm,
    segmentCount,
    parameters: params
  };
}

export function normalizeSpectralOptions(values, options = {}, defaults = DEFAULT_WELCH_PARAMETERS, mode = "welch") {
  const n = values?.length || 0;
  const sampleRateHz = Number(options.sampleRateHz ?? defaults.sampleRateHz ?? DEFAULT_SAMPLE_RATE_HZ);
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) throw new Error("Invalid spectral sampleRateHz: expected a finite value > 0.");

  const hasLegacySegmentLength = options.segmentLength !== undefined && options.segmentSeconds === undefined && options.segmentSamples === undefined;
  const requestedSegmentSamples = hasLegacySegmentLength
    ? Math.round(Number(options.segmentLength))
    : Math.round(Number(options.segmentSamples ?? (Number(options.segmentSeconds ?? defaults.segmentSeconds) * sampleRateHz)));
  const requestedSegmentSeconds = hasLegacySegmentLength
    ? requestedSegmentSamples / sampleRateHz
    : Number(options.segmentSeconds ?? requestedSegmentSamples / sampleRateHz);
  if (!Number.isFinite(requestedSegmentSeconds) || requestedSegmentSeconds <= 0) {
    throw new Error("Invalid spectral segmentSeconds: expected a finite value > 0.");
  }
  if (!Number.isInteger(requestedSegmentSamples) || requestedSegmentSamples < 8) {
    throw new Error("Invalid spectral segmentSamples: expected at least 8 samples.");
  }
  if (n > 0 && n < requestedSegmentSamples) {
    throw new Error(`Data too short for spectral analysis: segmentSamples ${requestedSegmentSamples} exceeds data length ${n}.`);
  }

  const effectiveSegmentSamples = requestedSegmentSamples;
  const effectiveSegmentSeconds = effectiveSegmentSamples / sampleRateHz;
  const requestedFftLength = Number(options.fftLengthSamples ?? 0);
  const fftLengthSamples = Math.max(
    effectiveSegmentSamples,
    nextPowerOfTwo(Number.isFinite(requestedFftLength) && requestedFftLength >= effectiveSegmentSamples
      ? Math.round(requestedFftLength)
      : effectiveSegmentSamples)
  );

  let requestedStepSamples;
  let requestedStepSeconds;
  if (options.stepSamples !== undefined) {
    requestedStepSamples = Math.round(Number(options.stepSamples));
    requestedStepSeconds = requestedStepSamples / sampleRateHz;
  } else if (options.stepSeconds !== undefined) {
    requestedStepSeconds = Number(options.stepSeconds);
    requestedStepSamples = Math.round(requestedStepSeconds * sampleRateHz);
  } else if (options.overlapSamples !== undefined || options.overlapRatio !== undefined) {
    const overlapRatioInput = options.overlapRatio !== undefined ? Number(options.overlapRatio) : undefined;
    if (overlapRatioInput !== undefined && (!Number.isFinite(overlapRatioInput) || overlapRatioInput < 0 || overlapRatioInput >= 1)) {
      throw new Error("Invalid spectral overlapRatio: expected 0 <= overlapRatio < 1.");
    }
    const overlapSamples = options.overlapSamples !== undefined
      ? Math.round(Number(options.overlapSamples))
      : Math.round(effectiveSegmentSamples * (overlapRatioInput ?? 0.5));
    requestedStepSamples = effectiveSegmentSamples - overlapSamples;
    requestedStepSeconds = requestedStepSamples / sampleRateHz;
  } else {
    requestedStepSeconds = Number(defaults.stepSeconds);
    requestedStepSamples = Math.round(requestedStepSeconds * sampleRateHz);
  }
  if (!Number.isFinite(requestedStepSeconds) || requestedStepSeconds <= 0) {
    throw new Error("Invalid spectral stepSeconds: expected a finite value > 0.");
  }
  if (!Number.isInteger(requestedStepSamples) || requestedStepSamples <= 0 || requestedStepSamples > effectiveSegmentSamples) {
    throw new Error("Invalid spectral stepSamples: expected 0 < stepSamples <= segmentSamples.");
  }
  const effectiveStepSamples = requestedStepSamples;
  const effectiveStepSeconds = effectiveStepSamples / sampleRateHz;
  const overlapSamples = effectiveSegmentSamples - effectiveStepSamples;
  const overlapRatio = overlapSamples / effectiveSegmentSamples;
  if (!Number.isFinite(overlapRatio) || overlapRatio < 0 || overlapRatio >= 1) {
    throw new Error("Invalid spectral overlapRatio: expected 0 <= overlapRatio < 1.");
  }

  const windowType = normalizeSpectralWindow(options.windowType ?? defaults.windowType);
  const detrend = normalizeSpectralDetrend(options.detrend ?? defaults.detrend);
  const scale = String(options.scale ?? defaults.scale ?? "linear").toLowerCase();
  if (!ALLOWED_SPECTRAL_SCALES.has(scale)) throw new Error("Invalid spectral scale: expected linear or log.");
  const averaging = String(options.averaging ?? defaults.averaging ?? "mean").toLowerCase();
  if (!ALLOWED_SPECTRAL_AVERAGING.has(averaging)) throw new Error("Invalid spectral averaging: expected mean or median.");
  const minValidRatio = Number(options.minValidRatio ?? defaults.minValidRatio ?? 0.75);
  if (!Number.isFinite(minValidRatio) || minValidRatio < 0 || minValidRatio > 1) {
    throw new Error("Invalid spectral minValidRatio: expected 0 <= minValidRatio <= 1.");
  }
  const nyquistHz = sampleRateHz / 2;
  const minHz = Number(options.minHz ?? 0);
  const maxHz = Number(options.maxHz ?? nyquistHz);
  if (!Number.isFinite(minHz) || !Number.isFinite(maxHz) || minHz < 0 || minHz >= maxHz) {
    throw new Error("Invalid spectral minHz/maxHz: expected 0 <= minHz < maxHz.");
  }
  if (maxHz > nyquistHz + 1e-12) {
    throw new Error(`Invalid spectral maxHz: expected maxHz <= Nyquist (${nyquistHz} Hz).`);
  }
  const maxPeaks = Math.round(Number(options.maxPeaks ?? defaults.maxPeaks ?? DEFAULT_WELCH_PARAMETERS.maxPeaks));
  if (!Number.isInteger(maxPeaks) || maxPeaks <= 0) throw new Error("Invalid spectral maxPeaks: expected a positive integer.");
  const gapHandlingMethod = String(options.gapHandlingMethod ?? options.imputationMethod ?? "segment-mean").toLowerCase();
  if (!ALLOWED_GAP_HANDLING.has(gapHandlingMethod)) {
    throw new Error("Invalid spectral gapHandlingMethod: expected reject, segment-mean, or short-gap-linear.");
  }
  const maxInterpolationGapSamples = Math.max(1, Math.round(Number(options.maxInterpolationGapSamples ?? 2)));
  const maxCells = Math.max(1, Math.round(Number(options.maxCells ?? DEFAULT_SPECTROGRAM_MAX_CELLS)));
  const fftBinSpacingHz = sampleRateHz / fftLengthSamples;
  const windowEquivalentNoiseBandwidthBins = equivalentNoiseBandwidthBins(makeWindow(windowType, effectiveSegmentSamples));
  const effectiveSpectralResolutionHz = windowEquivalentNoiseBandwidthBins * sampleRateHz / effectiveSegmentSamples;
  const frequencyResolutionHz = fftBinSpacingHz;
  const zeroPaddingApplied = fftLengthSamples !== effectiveSegmentSamples;
  const adjustmentReasons = [];
  const adjustmentReasonCodes = [];
  if (zeroPaddingApplied) {
    adjustmentReasons.push("FFT zero-padding to next power of two");
    adjustmentReasonCodes.push("fft-zero-padding");
  }
  if (Math.abs(effectiveSegmentSeconds - requestedSegmentSeconds) > EPSILON) {
    adjustmentReasons.push("segment duration rounded to whole samples");
    adjustmentReasonCodes.push("segment-rounded-to-samples");
  }
  if (Math.abs(effectiveStepSeconds - requestedStepSeconds) > EPSILON) {
    adjustmentReasons.push("step duration rounded to whole samples");
    adjustmentReasonCodes.push("step-rounded-to-samples");
  }
  const bands = options.bands || [{ name: "selected", minHz, maxHz }];
  const analysisStartEpochMs = Number.isFinite(Number(options.analysisStartEpochMs)) ? Number(options.analysisStartEpochMs) : null;
  const analysisTimezone = options.analysisTimezone || "UTC";
  const dataTimezone = options.dataTimezone || analysisTimezone;
  const displayTimezone = options.displayTimezone || dataTimezone;
  const utcOffset = options.utcOffset || timezoneOffsetLabel(displayTimezone, analysisStartEpochMs);
  const displaySummaryMode = String(options.displaySummaryMode ?? "detailed");
  const calculationResolutionSeconds = Number.isFinite(Number(options.calculationResolutionSeconds))
    ? Number(options.calculationResolutionSeconds)
    : 1 / sampleRateHz;
  const significantPeakSnrDb = Number(options.significantPeakSnrDb ?? DEFAULT_SPECTRAL_PEAK_CLASSIFICATION.significantSnrDb);
  const weakPeakSnrDb = Number(options.weakPeakSnrDb ?? DEFAULT_SPECTRAL_PEAK_CLASSIFICATION.weakSnrDb);
  const noisePeakSnrDb = Number(options.noisePeakSnrDb ?? DEFAULT_SPECTRAL_PEAK_CLASSIFICATION.noiseSnrDb);
  const minPeakProminenceRatio = Number(options.minPeakProminenceRatio ?? DEFAULT_SPECTRAL_PEAK_CLASSIFICATION.minProminenceRatio);
  const ridgeMinSnrDb = Number(options.ridgeMinSnrDb ?? DEFAULT_SPECTROGRAM_RIDGE_PARAMETERS.minSnrDb);
  const ridgeMinProminenceRatio = Number(options.ridgeMinProminenceRatio ?? DEFAULT_SPECTROGRAM_RIDGE_PARAMETERS.minProminenceRatio);
  const ridgeMinDurationSeconds = Math.max(0, Number(options.ridgeMinDurationSeconds ?? DEFAULT_SPECTROGRAM_RIDGE_PARAMETERS.minDurationSeconds));
  const ridgeMaxFrequencyJumpHz = Math.max(0, Number(options.ridgeMaxFrequencyJumpHz ?? DEFAULT_SPECTROGRAM_RIDGE_PARAMETERS.maxFrequencyJumpHz));
  const ridgeMinContinuityRatio = clamp01(Number(options.ridgeMinContinuityRatio ?? DEFAULT_SPECTROGRAM_RIDGE_PARAMETERS.minContinuityRatio));

  return {
    mode,
    sampleRateHz,
    requestedSegmentSeconds,
    requestedSegmentSamples,
    effectiveSegmentSeconds,
    effectiveSegmentSamples,
    segmentLength: effectiveSegmentSamples,
    fftLengthSamples,
    requestedStepSeconds,
    effectiveStepSeconds,
    effectiveStepSamples,
    stepSamples: effectiveStepSamples,
    overlapSamples,
    overlapRatio,
    frequencyResolutionHz,
    fftBinSpacingHz,
    effectiveSpectralResolutionHz,
    windowEquivalentNoiseBandwidthBins,
    zeroPaddingApplied,
    nyquistHz,
    adjustmentApplied: adjustmentReasons.length > 0,
    adjustmentReason: adjustmentReasons.length ? adjustmentReasons.join("; ") : "none",
    adjustmentReasonCodes,
    windowType,
    detrend,
    minHz,
    maxHz,
    maxPeaks,
    minValidRatio,
    bands,
    scale,
    averaging,
    gapHandlingMethod,
    maxInterpolationGapSamples,
    maxCells,
    analysisStartEpochMs,
    analysisTimezone,
    dataTimezone,
    displayTimezone,
    utcOffset,
    displaySummaryMode,
    calculationResolutionSeconds,
    significantPeakSnrDb,
    weakPeakSnrDb,
    noisePeakSnrDb,
    minPeakProminenceRatio,
    ridgeMinSnrDb,
    ridgeMinProminenceRatio,
    ridgeMinDurationSeconds,
    ridgeMaxFrequencyJumpHz,
    ridgeMinContinuityRatio
  };
}

export function prepareSegment(values, start, length, params = {}) {
  const minValidRatio = Number(params.minValidRatio ?? 0.75);
  const gapHandlingMethod = String(params.gapHandlingMethod ?? "segment-mean").toLowerCase();
  const maxInterpolationGapSamples = Math.max(1, Math.round(Number(params.maxInterpolationGapSamples ?? 2)));
  const raw = new Float64Array(length);
  let validCount = 0;
  let missingCount = 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const value = Number(values?.[start + i]);
    raw[i] = Number.isFinite(value) ? value : NaN;
    if (Number.isFinite(value)) {
      validCount += 1;
      sum += value;
    } else {
      missingCount += 1;
    }
  }
  const validRatio = length ? validCount / length : 0;
  const base = {
    values: new Float64Array(),
    validCount,
    missingCount,
    validRatio,
    imputedCount: 0,
    accepted: false,
    rejectedReason: null,
    imputationMethod: missingCount ? gapHandlingMethod : "none"
  };
  if (validRatio < minValidRatio) {
    return { ...base, rejectedReason: "min-valid-ratio" };
  }
  if (!validCount) {
    return { ...base, rejectedReason: "no-valid-samples" };
  }
  if (missingCount && gapHandlingMethod === "reject") {
    return { ...base, rejectedReason: "missing-data" };
  }

  const out = new Float64Array(length);
  let imputedCount = 0;
  if (!missingCount) {
    for (let i = 0; i < length; i += 1) out[i] = raw[i];
  } else if (gapHandlingMethod === "segment-mean") {
    const mean = sum / validCount;
    for (let i = 0; i < length; i += 1) out[i] = Number.isFinite(raw[i]) ? raw[i] : mean;
    imputedCount = missingCount;
  } else if (gapHandlingMethod === "short-gap-linear") {
    for (let i = 0; i < length; i += 1) out[i] = raw[i];
    for (let i = 0; i < length;) {
      if (Number.isFinite(out[i])) {
        i += 1;
        continue;
      }
      const gapStart = i;
      while (i < length && !Number.isFinite(out[i])) i += 1;
      const gapEndExclusive = i;
      const gapLength = gapEndExclusive - gapStart;
      const left = gapStart - 1;
      const right = gapEndExclusive;
      if (
        left < 0
        || right >= length
        || gapLength > maxInterpolationGapSamples
        || !Number.isFinite(out[left])
        || !Number.isFinite(out[right])
      ) {
        return { ...base, rejectedReason: "unfilled-gap", imputationMethod: "short-gap-linear" };
      }
      const leftValue = out[left];
      const rightValue = out[right];
      for (let j = 1; j <= gapLength; j += 1) {
        out[left + j] = leftValue + (rightValue - leftValue) * (j / (gapLength + 1));
      }
      imputedCount += gapLength;
    }
  } else {
    return { ...base, rejectedReason: "unsupported-gap-handling" };
  }

  const detrend = normalizeSpectralDetrend(params.detrend ?? "constant");
  if (detrend === "linear") removeLinearTrend(out);
  else if (detrend === "constant") {
    let mean = 0;
    for (let i = 0; i < out.length; i += 1) mean += out[i];
    mean /= Math.max(1, out.length);
    for (let i = 0; i < out.length; i += 1) out[i] -= mean;
  }
  return {
    values: out,
    validCount,
    missingCount,
    validRatio,
    imputedCount,
    accepted: true,
    rejectedReason: null,
    imputationMethod: missingCount ? gapHandlingMethod : "none"
  };
}

function normalizeSpectralWindow(type) {
  const normalized = String(type || "hann").toLowerCase();
  const canonical = normalized === "rect" ? "rectangular" : normalized;
  if (!ALLOWED_SPECTRAL_WINDOWS.has(canonical)) {
    throw new Error("Invalid spectral windowType: expected hann, hamming, or rectangular.");
  }
  return canonical;
}

function normalizeSpectralDetrend(value) {
  const normalized = value === false ? "none" : String(value ?? "constant").toLowerCase();
  if (!ALLOWED_SPECTRAL_DETRENDS.has(normalized)) {
    throw new Error("Invalid spectral detrend: expected constant, linear, or none.");
  }
  return normalized;
}

function medianColumn(periodograms, columnIndex) {
  if (!periodograms.length) return NaN;
  const values = [];
  for (const periodogram of periodograms) {
    const value = periodogram[columnIndex];
    if (Number.isFinite(value)) values.push(value);
  }
  return percentile(values, 0.5);
}

function ratioToDb(value) {
  return Number.isFinite(value) && value > 0 ? 10 * Math.log10(value) : NaN;
}

function powerToDb(value) {
  return Number.isFinite(value) && value > 0 ? 10 * Math.log10(value) : NaN;
}

function equivalentNoiseBandwidthBins(window) {
  let sum = 0;
  let sumSquares = 0;
  for (const value of window || []) {
    sum += value;
    sumSquares += value * value;
  }
  return sum > EPSILON ? (window.length * sumSquares) / (sum * sum) : 1;
}

function effectiveWelchDegreesOfFreedom(segmentCount, overlapRatio, averagingMethod) {
  const nominal = Math.max(0, segmentCount * 2);
  if (!nominal) return 0;
  const overlapPenalty = 1 - Math.min(0.75, Math.max(0, Number(overlapRatio) || 0)) * 0.5;
  const averagingPenalty = averagingMethod === "median" ? 0.7 : 1;
  return Math.max(1, nominal * overlapPenalty * averagingPenalty);
}

function classifySpectralPeak({ snrDb, peakProminence, noiseFloor }, params = {}) {
  const prominenceRatio = Math.max(0, Number(peakProminence) || 0) / Math.max(Math.abs(Number(noiseFloor) || 0), EPSILON);
  if (!Number.isFinite(snrDb) || !Number.isFinite(peakProminence) || peakProminence <= EPSILON) return "rejected";
  if (snrDb >= params.significantPeakSnrDb && prominenceRatio >= params.minPeakProminenceRatio) return "significant";
  if (snrDb >= params.weakPeakSnrDb && prominenceRatio >= params.minPeakProminenceRatio) return "weak";
  if (snrDb >= params.noisePeakSnrDb) return "noise";
  return "rejected";
}

function peakConfidenceLevel(status) {
  if (status === "significant") return "high";
  if (status === "weak") return "medium";
  if (status === "noise") return "low";
  return "rejected";
}

function isSignificantSpectrogramPeak(peak, params = {}) {
  const prominenceRatio = Math.max(0, Number(peak.peakProminence) || 0) / Math.max(Math.abs(Number(peak.noiseFloor) || 0), EPSILON);
  return Number.isFinite(peak.snrDb)
    && peak.snrDb >= params.ridgeMinSnrDb
    && prominenceRatio >= params.ridgeMinProminenceRatio;
}

function buildSpectrogramRegions(ridgePoints, params = {}) {
  const regions = [];
  let current = null;
  const segmentHalf = (params.effectiveSegmentSeconds || 0) / 2;
  const closeCurrent = () => {
    if (!current) return;
    const durationSeconds = Math.max(0, current.endSecond - current.startSecond);
    const continuityRatio = current.totalWindows ? current.significantWindows / current.totalWindows : 0;
    if (
      durationSeconds >= params.ridgeMinDurationSeconds
      && continuityRatio >= params.ridgeMinContinuityRatio
      && current.significantWindows > 0
    ) {
      const frequencies = current.points.map(point => point.frequencyHz).filter(Number.isFinite);
      const powers = current.points.map(point => point.power).filter(Number.isFinite);
      const snrs = current.points.map(point => point.snrDb).filter(Number.isFinite);
      const validRatios = current.points.map(point => point.validRatio).filter(Number.isFinite);
      regions.push({
        startSeconds: current.startSecond,
        endSeconds: current.endSecond,
        durationSeconds,
        medianFrequencyHz: percentile(frequencies, 0.5),
        minFrequencyHz: minArrayFinite(frequencies),
        maxFrequencyHz: maxArrayFinite(frequencies),
        peakPsd: maxArrayFinite(powers),
        snrDb: percentile(snrs, 0.5),
        ridgeContinuity: continuityRatio,
        validRatio: percentile(validRatios, 0.5),
        significantWindowCount: current.significantWindows,
        totalWindowCount: current.totalWindows
      });
    }
    current = null;
  };
  for (const point of ridgePoints || []) {
    const significant = Boolean(point?.significant) && Number.isFinite(point.frequencyHz);
    if (!significant) {
      if (current) current.totalWindows += 1;
      closeCurrent();
      continue;
    }
    const startSecond = Math.max(0, point.timeSeconds - segmentHalf);
    const endSecond = point.timeSeconds + segmentHalf;
    if (
      !current
      || Math.abs(point.frequencyHz - current.lastFrequencyHz) > params.ridgeMaxFrequencyJumpHz
    ) {
      closeCurrent();
      current = {
        startSecond,
        endSecond,
        lastFrequencyHz: point.frequencyHz,
        points: [],
        significantWindows: 0,
        totalWindows: 0
      };
    }
    current.endSecond = endSecond;
    current.lastFrequencyHz = point.frequencyHz;
    current.points.push(point);
    current.significantWindows += 1;
    current.totalWindows += 1;
  }
  closeCurrent();
  return regions;
}

function enrichSpectralPeaks(peaks, frequencies, values, noiseFloor, params = {}) {
  return peaks.map((peak, rankIndex) => {
    const index = Number.isInteger(peak.index)
      ? peak.index
      : nearestFrequencyIndex(frequencies, peak.frequencyHz);
    const peakBandwidthHz = estimatePeakBandwidthHz(frequencies, values, index);
    const snrLinear = peak.value / Math.max(noiseFloor, EPSILON);
    const snrDb = ratioToDb(snrLinear);
    const peakProminence = peak.value - noiseFloor;
    const peakStatus = classifySpectralPeak({ snrDb, peakProminence, noiseFloor }, params);
    return {
      rank: rankIndex + 1,
      frequencyHz: peak.frequencyHz,
      periodSeconds: peak.frequencyHz > 0 ? 1 / peak.frequencyHz : Infinity,
      psd: peak.value,
      power: peak.value,
      psdLevelDb: powerToDb(peak.value),
      snrLinear,
      snrDb,
      peakProminence,
      peakBandwidthHz,
      qualityFactor: peakBandwidthHz > EPSILON ? peak.frequencyHz / peakBandwidthHz : NaN,
      peakStatus,
      confidenceLevel: peakConfidenceLevel(peakStatus),
      rejectedReason: peakStatus === "rejected" ? "below-snr-or-prominence-threshold" : null
    };
  });
}

function nearestFrequencyIndex(frequencies, frequencyHz) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < frequencies.length; index += 1) {
    const distance = Math.abs(frequencies[index] - frequencyHz);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function estimatePeakBandwidthHz(frequencies, values, index) {
  if (!Number.isInteger(index) || index < 0 || index >= values.length) return NaN;
  const peak = values[index];
  if (!Number.isFinite(peak) || peak <= 0) return NaN;
  const halfPower = peak / 2;
  let left = index;
  while (left > 0 && Number.isFinite(values[left - 1]) && values[left - 1] >= halfPower) left -= 1;
  let right = index;
  while (right < values.length - 1 && Number.isFinite(values[right + 1]) && values[right + 1] >= halfPower) right += 1;
  const leftHz = frequencies[left] ?? frequencies[index];
  const rightHz = frequencies[right] ?? frequencies[index];
  const resolution = frequencies.length > 1 ? Math.abs(frequencies[1] - frequencies[0]) : 0;
  return Math.max(resolution, Math.abs(rightHz - leftHz));
}

function spectralQualitySummary({
  params,
  candidateSegmentCount,
  acceptedSegmentCount,
  imputedSegmentCount,
  totalImputedSampleCount,
  acceptedValidRatioSum,
  minimumAcceptedValidRatio
}) {
  return {
    candidateSegmentCount,
    acceptedSegmentCount,
    rejectedSegmentCount: Math.max(0, candidateSegmentCount - acceptedSegmentCount),
    imputedSegmentCount,
    totalImputedSampleCount,
    meanValidRatio: acceptedSegmentCount ? acceptedValidRatioSum / acceptedSegmentCount : 0,
    minimumAcceptedValidRatio: acceptedSegmentCount ? minimumAcceptedValidRatio : params.minValidRatio,
    gapHandlingMethod: params.gapHandlingMethod
  };
}

function spectralConfidenceInterval95(degreesOfFreedom, averagingMethod = "mean") {
  const dof = Math.max(1, Number(degreesOfFreedom) || 1);
  const relativeStd = Math.sqrt(2 / dof);
  return {
    lowerFactor: Math.max(0, 1 - 1.96 * relativeStd),
    upperFactor: 1 + 1.96 * relativeStd,
    degreesOfFreedom: dof,
    approximate: true,
    averagingMethod
  };
}

function integratePower(frequencies, psd, minHz = 0, maxHz = Infinity) {
  if (!frequencies?.length || !psd?.length) return NaN;
  const df = frequencies.length > 1 ? Math.abs(frequencies[1] - frequencies[0]) : 0;
  let total = 0;
  for (let index = 0; index < frequencies.length; index += 1) {
    const frequency = frequencies[index];
    const value = psd[index];
    if (frequency >= minHz - 1e-12 && frequency <= maxHz + 1e-12 && Number.isFinite(value)) total += value * df;
  }
  return total;
}

function finiteVariance(values) {
  let count = 0;
  let sum = 0;
  let sumSquares = 0;
  for (const raw of values || []) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    count += 1;
    sum += value;
    sumSquares += value * value;
  }
  if (!count) return NaN;
  const mean = sum / count;
  return Math.max(0, sumSquares / count - mean * mean);
}

function removeLinearTrend(values) {
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXX += i * i;
    sumXY += i * values[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < EPSILON) return;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  for (let i = 0; i < n; i += 1) values[i] -= intercept + slope * i;
}

function segmentStarts(n, length, step) {
  if (n < length) return n ? [0] : [];
  const starts = [];
  for (let start = 0; start + length <= n; start += step) starts.push(start);
  return starts;
}

function makeWindow(type, n) {
  const out = new Float64Array(n);
  const key = String(type || "hann").toLowerCase();
  if (key === "rectangular" || key === "rect") {
    out.fill(1);
    return out;
  }
  for (let i = 0; i < n; i += 1) {
    if (key === "hamming") out[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / Math.max(1, n - 1));
    else out[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / Math.max(1, n - 1)));
  }
  return out;
}

function fftReal(values) {
  const n = values.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(values);
  if (isPowerOfTwo(n)) fftComplexInPlace(re, im);
  else dftComplexInPlace(re, im);
  return { re, im };
}

function fftComplexInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wlenRe = Math.cos(angle);
    const wlenIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
}

function dftComplexInPlace(re, im) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    let sumRe = 0;
    let sumIm = 0;
    for (let t = 0; t < n; t += 1) {
      const angle = -2 * Math.PI * k * t / n;
      sumRe += re[t] * Math.cos(angle) - im[t] * Math.sin(angle);
      sumIm += re[t] * Math.sin(angle) + im[t] * Math.cos(angle);
    }
    outRe[k] = sumRe;
    outIm[k] = sumIm;
  }
  re.set(outRe);
  im.set(outIm);
}

function filterFrequencyRange(frequencies, values, minHz, maxHz) {
  const outF = [];
  const outV = [];
  for (let i = 0; i < frequencies.length; i += 1) {
    const f = frequencies[i];
    if (f >= minHz - 1e-12 && f <= maxHz + 1e-12) {
      outF.push(f);
      outV.push(values[i]);
    }
  }
  return { frequencies: outF, values: outV };
}

function findPeaks(frequencies, values, maxPeaks) {
  const peaks = [];
  for (let i = 0; i < values.length; i += 1) {
    const left = i === 0 ? -Infinity : values[i - 1];
    const right = i === values.length - 1 ? -Infinity : values[i + 1];
    if (Number.isFinite(values[i]) && values[i] >= left && values[i] >= right) {
      peaks.push({ frequencyHz: frequencies[i], value: values[i], index: i });
    }
  }
  if (!peaks.length && values.length) {
    const index = values.reduce((best, value, i) => value > values[best] ? i : best, 0);
    peaks.push({ frequencyHz: frequencies[index], value: values[index], index });
  }
  return peaks.sort((a, b) => b.value - a.value).slice(0, maxPeaks);
}

function medianWithoutPeakBins(values, peaks, frequencies) {
  const peakFrequencies = new Set(peaks.slice(0, 3).map(peak => peak.frequencyHz));
  const filtered = values.filter((_, index) => !peakFrequencies.has(frequencies[index]));
  return percentile(filtered.length ? filtered : values, 0.5) || EPSILON;
}

function computeBandEnergies(frequencies, psd, bands) {
  const df = frequencies.length > 1 ? frequencies[1] - frequencies[0] : 0;
  return bands.map(band => {
    let energy = 0;
    for (let i = 0; i < frequencies.length; i += 1) {
      if (frequencies[i] >= band.minHz && frequencies[i] <= band.maxHz) energy += psd[i] * df;
    }
    return { name: band.name || `${band.minHz}-${band.maxHz}`, minHz: band.minHz, maxHz: band.maxHz, energy };
  });
}

function emptyPsd(params, quality = spectralQualitySummary({
  params,
  candidateSegmentCount: 0,
  acceptedSegmentCount: 0,
  imputedSegmentCount: 0,
  totalImputedSampleCount: 0,
  acceptedValidRatioSum: 0,
  minimumAcceptedValidRatio: Infinity
})) {
  return {
    method: "welch-psd",
    units: "Hz^2/Hz",
    sampleRateHz: params.sampleRateHz,
    segmentLength: params.segmentLength,
    requestedSegmentSeconds: params.requestedSegmentSeconds,
    requestedSegmentSamples: params.requestedSegmentSamples,
    effectiveSegmentSeconds: params.effectiveSegmentSeconds,
    effectiveSegmentSamples: params.effectiveSegmentSamples,
    fftLengthSamples: params.fftLengthSamples,
    requestedStepSeconds: params.requestedStepSeconds,
    effectiveStepSeconds: params.effectiveStepSeconds,
    effectiveStepSamples: params.effectiveStepSamples,
    overlapSamples: params.overlapSamples,
    overlapRatio: params.overlapRatio,
    frequencyResolutionHz: params.frequencyResolutionHz,
    fftBinSpacingHz: params.fftBinSpacingHz,
    effectiveSpectralResolutionHz: params.effectiveSpectralResolutionHz,
    windowEquivalentNoiseBandwidthBins: params.windowEquivalentNoiseBandwidthBins,
    zeroPaddingApplied: params.zeroPaddingApplied,
    nyquistHz: params.nyquistHz,
    adjustmentApplied: params.adjustmentApplied,
    adjustmentReason: params.adjustmentReason,
    adjustmentReasonCodes: params.adjustmentReasonCodes,
    windowType: params.windowType,
    detrend: params.detrend,
    segmentCount: 0,
    candidateSegmentCount: quality.candidateSegmentCount,
    acceptedSegmentCount: quality.acceptedSegmentCount,
    rejectedSegmentCount: quality.rejectedSegmentCount,
    imputedSegmentCount: quality.imputedSegmentCount,
    totalImputedSampleCount: quality.totalImputedSampleCount,
    meanValidRatio: quality.meanValidRatio,
    minimumAcceptedValidRatio: quality.minimumAcceptedValidRatio,
    gapHandlingMethod: quality.gapHandlingMethod,
    frequencies: [],
    psd: [],
    allFrequencies: [],
    allPsd: [],
    peaks: [],
    peakCandidates: [],
    bandEnergies: [],
    noiseFloor: NaN,
    snr: NaN,
    snrLinear: NaN,
    snrDb: NaN,
    degreesOfFreedom: 0,
    nominalDegreesOfFreedom: 0,
    effectiveDegreesOfFreedom: 0,
    confidenceInterval95: spectralConfidenceInterval95(1, params.averaging),
    totalBandPower: NaN,
    parsevalErrorRatio: NaN,
    averagingMethod: params.averaging,
    scale: params.scale,
    analysisStartEpochMs: params.analysisStartEpochMs,
    analysisTimezone: params.analysisTimezone,
    dataTimezone: params.dataTimezone,
    displayTimezone: params.displayTimezone,
    utcOffset: params.utcOffset,
    calculationResolutionSeconds: params.calculationResolutionSeconds,
    displaySummaryMode: params.displaySummaryMode,
    frequencyHz: NaN,
    power: NaN,
    parameters: { ...params }
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

function percentile(values, p) {
  const clean = finiteValues(values).sort((a, b) => a - b);
  if (!clean.length) return NaN;
  const index = (clean.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return clean[lower];
  return clean[lower] + (clean[upper] - clean[lower]) * (index - lower);
}

function minArrayFinite(values) {
  let best = Infinity;
  for (const value of values || []) {
    if (Number.isFinite(value) && value < best) best = value;
  }
  return best === Infinity ? NaN : best;
}

function maxArrayFinite(values) {
  let best = -Infinity;
  for (const value of values || []) {
    if (Number.isFinite(value) && value > best) best = value;
  }
  return best === -Infinity ? NaN : best;
}

function timezoneOffsetLabel(timeZone, epochMs = null) {
  if (!timeZone || timeZone === "UTC") return "+00:00";
  const instant = new Date(Number.isFinite(epochMs) ? epochMs : Date.now());
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "shortOffset"
    }).formatToParts(instant);
    const zone = parts.find(part => part.type === "timeZoneName")?.value || "";
    const match = zone.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (match) {
      const sign = match[1];
      const hours = String(Number(match[2])).padStart(2, "0");
      const minutes = String(Number(match[3] || 0)).padStart(2, "0");
      return `${sign}${hours}:${minutes}`;
    }
  } catch {}
  if (timeZone === "Europe/Istanbul") return "+03:00";
  if (timeZone === "Europe/Berlin") {
    const month = instant.getUTCMonth() + 1;
    return month >= 4 && month <= 10 ? "+02:00" : "+01:00";
  }
  return "+00:00";
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

function allFinite(values, start, end) {
  if (start < 0 || end >= (values?.length || 0)) return false;
  for (let i = start; i <= end; i += 1) {
    if (!Number.isFinite(values[i])) return false;
  }
  return true;
}

function rocofFrequencyStats(values, startIndex, endIndex, sampleIntervalSeconds, startSecond) {
  let minFrequencyHz = Infinity;
  let maxFrequencyHz = -Infinity;
  let minFrequencyIndex = startIndex;
  let maxFrequencyIndex = startIndex;
  for (let i = startIndex; i <= endIndex; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) continue;
    if (value < minFrequencyHz) {
      minFrequencyHz = value;
      minFrequencyIndex = i;
    }
    if (value > maxFrequencyHz) {
      maxFrequencyHz = value;
      maxFrequencyIndex = i;
    }
  }
  return {
    startFrequencyHz: Number.isFinite(values[startIndex]) ? values[startIndex] : NaN,
    startFrequencySecond: startSecond + startIndex * sampleIntervalSeconds,
    endFrequencyHz: Number.isFinite(values[endIndex]) ? values[endIndex] : NaN,
    endFrequencySecond: startSecond + endIndex * sampleIntervalSeconds,
    minFrequencyHz: Number.isFinite(minFrequencyHz) ? minFrequencyHz : NaN,
    minFrequencySecond: startSecond + minFrequencyIndex * sampleIntervalSeconds,
    maxFrequencyHz: Number.isFinite(maxFrequencyHz) ? maxFrequencyHz : NaN,
    maxFrequencySecond: startSecond + maxFrequencyIndex * sampleIntervalSeconds
  };
}

function thresholdEvents(series, params, values = [], startSecond = 0) {
  const events = [];
  const sampleIntervalSeconds = params.sampleIntervalSeconds;
  const minEventSeconds = params.minEventSeconds;
  const enterLimit = Math.abs(params.hysteresisEnabled ? params.enterThresholdHzPerSecond : params.thresholdHzPerSecond);
  const exitLimit = Math.abs(params.hysteresisEnabled ? params.exitThresholdHzPerSecond : params.thresholdHzPerSecond);
  const mergeGapSamples = Math.max(0, Math.floor((params.mergeGapSeconds || 0) / sampleIntervalSeconds));
  let start = null;
  let side = null;
  let peak = 0;
  let lastIncluded = null;
  let pendingGapStart = null;
  let pendingGapCount = 0;
  const closeRun = endIndex => {
    if (start === null || !side || endIndex < start) {
      start = null;
      side = null;
      peak = 0;
      lastIncluded = null;
      pendingGapStart = null;
      pendingGapCount = 0;
      return;
    }
    const durationSeconds = (endIndex - start + 1) * sampleIntervalSeconds;
    if (durationSeconds >= minEventSeconds) {
      const frequencyStats = rocofFrequencyStats(values, start, endIndex, sampleIntervalSeconds, startSecond);
      events.push({
        type: "rocof",
        eventType: "rocof",
        side,
        startSecond: startSecond + start * sampleIntervalSeconds,
        lastViolationSecond: startSecond + endIndex * sampleIntervalSeconds,
        endExclusiveSecond: startSecond + (endIndex + 1) * sampleIntervalSeconds,
        endSecond: startSecond + (endIndex + 1) * sampleIntervalSeconds,
        durationSeconds,
        peakHzPerSecond: peak,
        peakMhzPerSecond: peak * 1000,
        value: peak,
        classification: side,
        shortLabel: side === "positive" ? "R+" : "R−",
        ...frequencyStats
      });
    }
    start = null;
    side = null;
    peak = 0;
    lastIncluded = null;
    pendingGapStart = null;
    pendingGapCount = 0;
  };
  const sideForEnter = value => {
    if (!Number.isFinite(value)) return null;
    if (value > enterLimit) return "positive";
    if (value < -enterLimit) return "negative";
    return null;
  };
  const remainsInsideHysteresis = value => {
    if (!params.hysteresisEnabled || !side || !Number.isFinite(value)) return false;
    return side === "positive" ? value > exitLimit : value < -exitLimit;
  };
  const beginRun = (index, currentSide, value) => {
    start = index;
    side = currentSide;
    peak = value;
    lastIncluded = index;
    pendingGapStart = null;
    pendingGapCount = 0;
  };
  const includeSample = (index, value) => {
    lastIncluded = index;
    pendingGapStart = null;
    pendingGapCount = 0;
    if (Number.isFinite(value) && (side === "positive" ? value > peak : value < peak)) peak = value;
  };

  for (let i = 0; i < series.length; i += 1) {
    const value = series[i];
    const currentSide = sideForEnter(value);
    if (!Number.isFinite(value)) {
      closeRun(pendingGapStart !== null ? pendingGapStart - 1 : lastIncluded ?? i - 1);
      continue;
    }
    if (currentSide && start === null) {
      beginRun(i, currentSide, value);
      continue;
    }
    if (start === null) continue;
    if (currentSide && currentSide !== side) {
      closeRun(pendingGapStart !== null ? pendingGapStart - 1 : i - 1);
      beginRun(i, currentSide, value);
      continue;
    }
    if ((currentSide && currentSide === side) || remainsInsideHysteresis(value)) {
      includeSample(i, value);
      continue;
    }
    if (mergeGapSamples > 0) {
      if (pendingGapStart === null) {
        pendingGapStart = i;
        pendingGapCount = 1;
      } else {
        pendingGapCount += 1;
      }
      if (pendingGapCount <= mergeGapSamples) {
        lastIncluded = i;
        continue;
      }
      closeRun(pendingGapStart - 1);
      continue;
    }
    closeRun(i - 1);
  }
  closeRun(pendingGapStart !== null ? pendingGapStart - 1 : lastIncluded ?? series.length - 1);
  return events;
}

function correlationAtLag(a, b, lagSamples) {
  const xs = [];
  const ys = [];
  const n = Math.min(a?.length || 0, b?.length || 0);
  for (let i = 0; i < n; i += 1) {
    const j = i + lagSamples;
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

function movingAverage(values, windowSamples) {
  const n = values?.length || 0;
  const out = new Float64Array(n);
  out.fill(NaN);
  const radius = Math.max(0, Math.floor(windowSamples / 2));
  for (let i = 0; i < n; i += 1) {
    const from = i - radius;
    const to = i + radius;
    if (!allFinite(values, from, to)) continue;
    let sum = 0;
    for (let j = from; j <= to; j += 1) {
      sum += values[j];
    }
    out[i] = sum / (to - from + 1);
  }
  return out;
}

function contiguousRegions(points, predicate) {
  const regions = [];
  let start = null;
  let max = 0;
  for (const point of points) {
    if (predicate(point)) {
      if (!start) {
        start = point;
        max = point.coherence;
      } else {
        max = Math.max(max, point.coherence);
      }
    } else if (start) {
      const previous = points[points.indexOf(point) - 1];
      regions.push({ startHz: start.frequencyHz, endHz: previous.frequencyHz, maxCoherence: max });
      start = null;
    }
  }
  if (start) {
    const last = points[points.length - 1];
    regions.push({ startHz: start.frequencyHz, endHz: last.frequencyHz, maxCoherence: max });
  }
  return regions;
}

function nearestPoint(points, target, valueKey) {
  if (!points?.length) return null;
  return points.reduce((best, point) => Math.abs(point.frequencyHz - target) < Math.abs(best.frequencyHz - target) ? point : best, points[0]);
}

function nearestIndex(values, target) {
  if (!values?.length) return 0;
  let best = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (Math.abs(values[i] - target) < Math.abs(values[best] - target)) best = i;
  }
  return best;
}

function unwrapPhase(values) {
  if (!values.length) return [];
  const out = [values[0]];
  let offset = 0;
  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta > Math.PI) offset -= 2 * Math.PI;
    else if (delta < -Math.PI) offset += 2 * Math.PI;
    out.push(values[i] + offset);
  }
  return out;
}

function circularMean(values) {
  if (!values.length) return NaN;
  const re = values.reduce((sum, value) => sum + Math.cos(value), 0) / values.length;
  const im = values.reduce((sum, value) => sum + Math.sin(value), 0) / values.length;
  return Math.atan2(im, re);
}

function circularStability(values) {
  if (!values.length) return 0;
  const re = values.reduce((sum, value) => sum + Math.cos(value), 0) / values.length;
  const im = values.reduce((sum, value) => sum + Math.sin(value), 0) / values.length;
  return Math.hypot(re, im);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function previousPowerOfTwo(value) {
  return 2 ** Math.max(3, Math.floor(Math.log2(Math.max(8, value))));
}

function nextPowerOfTwo(value) {
  return 2 ** Math.max(3, Math.ceil(Math.log2(Math.max(8, value))));
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
  DEFAULT_OSCILLATION_PARAMETERS,
  DEFAULT_ROCOF_PARAMETERS,
  DEFAULT_SPECTROGRAM_PARAMETERS,
  DEFAULT_WELCH_PARAMETERS,
  analyzeDataQuality,
  computeBasicStats,
  computeCrossCorrelation,
  computeCrossPowerSpectralDensity,
  computeMagnitudeSquaredCoherence,
  computeOscillationCandidates,
  computeOscillationConfidence,
  computeRocof,
  computeStftSpectrogram,
  computeWelchPsd,
  createSyntheticSignal,
  dominantFrequencyScan,
  estimateCoherence,
  estimateDominantFrequency,
  estimatePhaseDifference,
  hzPerSecondToMhzPerSecond,
  mHzPerSecondToHzPerSecond,
  normalizeOscillationParameters,
  normalizeSpectralOptions,
  prepareSegment,
  normalizeRocofParameters
};

globalThis.FrequencyAnalysisCore = FrequencyAnalysisCore;
