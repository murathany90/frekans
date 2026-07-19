const DEFAULT_NOMINAL_HZ = 50;
const DEFAULT_SAMPLE_RATE_HZ = 1;
const EPSILON = 1e-18;

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

export function computeRocof(values, {
  method = "central",
  sampleIntervalSeconds = 1,
  windowSeconds = 5,
  preFilterSeconds = 5,
  thresholdHzPerSecond = 0.01,
  minEventSeconds = 1,
  startSecond = 0
} = {}) {
  const n = values?.length || 0;
  const dt = Math.max(EPSILON, Number(sampleIntervalSeconds) || 1);
  const normalizedMethod = method === "centralDifference" ? "central" : method;
  const rocof = new Float64Array(n);
  rocof.fill(NaN);

  if (normalizedMethod === "movingRegression") {
    const radius = Math.max(1, Math.floor((windowSeconds / dt) / 2));
    for (let i = radius; i < n - radius; i += 1) {
      const from = i - radius;
      const to = i + radius;
      if (!allFinite(values, from, to)) continue;
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
    }
  } else {
    const source = normalizedMethod === "filteredDerivative" ? movingAverage(values, Math.max(1, Math.round(preFilterSeconds / dt))) : values;
    for (let i = 0; i < n; i += 1) {
      const prevIndex = normalizedMethod === "simple" ? i - 1 : i - 1;
      const nextIndex = normalizedMethod === "simple" ? i : i + 1;
      if (prevIndex < 0 || nextIndex >= n) continue;
      if (!Number.isFinite(values[i]) || !Number.isFinite(values[prevIndex]) || !Number.isFinite(values[nextIndex])) continue;
      const a = source[prevIndex];
      const c = source[i];
      const b = source[nextIndex];
      if (!Number.isFinite(a) || !Number.isFinite(c) || !Number.isFinite(b)) continue;
      rocof[i] = (b - a) / ((nextIndex - prevIndex) * dt);
    }
  }

  const clean = finiteValues(rocof);
  const abs = clean.map(Math.abs);
  const events = thresholdEvents(rocof, thresholdHzPerSecond, minEventSeconds, dt, values, startSecond);
  return {
    series: rocof,
    method: normalizedMethod,
    sampleIntervalSeconds: dt,
    maxPositive: clean.length ? Math.max(...clean) : NaN,
    maxNegative: clean.length ? Math.min(...clean) : NaN,
    meanAbsolute: abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : NaN,
    rms: abs.length ? Math.sqrt(clean.reduce((sum, v) => sum + v * v, 0) / abs.length) : NaN,
    sampleCount: n,
    rocofSampleCount: clean.length,
    unavailableSamples: n - clean.length,
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
  const params = normalizeSpectralOptions(values, options);
  const window = makeWindow(params.windowType, params.segmentLength);
  const windowEnergy = window.reduce((sum, value) => sum + value * value, 0);
  const binCount = Math.floor(params.segmentLength / 2) + 1;
  const accum = new Float64Array(binCount);
  let segmentCount = 0;
  const starts = segmentStarts(values?.length || 0, params.segmentLength, params.stepSamples);

  for (const start of starts) {
    const prepared = prepareSegment(values, start, params.segmentLength, params);
    if (!prepared) continue;
    for (let i = 0; i < prepared.length; i += 1) prepared[i] *= window[i];
    const spectrum = fftReal(prepared);
    for (let k = 0; k < binCount; k += 1) {
      let scale = 1 / (params.sampleRateHz * windowEnergy);
      if (k > 0 && k < params.segmentLength / 2) scale *= 2;
      accum[k] += (spectrum.re[k] * spectrum.re[k] + spectrum.im[k] * spectrum.im[k]) * scale;
    }
    segmentCount += 1;
  }

  if (!segmentCount) return emptyPsd(params);

  const allFrequencies = new Float64Array(binCount);
  const allPsd = new Float64Array(binCount);
  for (let k = 0; k < binCount; k += 1) {
    allFrequencies[k] = k * params.sampleRateHz / params.segmentLength;
    allPsd[k] = accum[k] / segmentCount;
  }
  const filtered = filterFrequencyRange(allFrequencies, allPsd, params.minHz, params.maxHz);
  const peaks = findPeaks(filtered.frequencies, filtered.values, params.maxPeaks).map(peak => ({
    frequencyHz: peak.frequencyHz,
    psd: peak.value,
    power: peak.value
  }));
  const noiseFloor = medianWithoutPeakBins(filtered.values, peaks, filtered.frequencies);
  const bandEnergies = computeBandEnergies(allFrequencies, allPsd, params.bands);
  const firstPeak = peaks[0] || { frequencyHz: NaN, psd: NaN, power: NaN };
  return {
    method: "welch-psd",
    units: "Hz^2/Hz",
    sampleRateHz: params.sampleRateHz,
    segmentLength: params.segmentLength,
    overlapSamples: params.overlapSamples,
    overlapRatio: params.overlapRatio,
    windowType: params.windowType,
    detrend: params.detrend,
    segmentCount,
    frequencies: Array.from(filtered.frequencies),
    psd: Array.from(filtered.values),
    allFrequencies: Array.from(allFrequencies),
    allPsd: Array.from(allPsd),
    peaks,
    bandEnergies,
    noiseFloor,
    snr: Number.isFinite(firstPeak.psd) ? firstPeak.psd / Math.max(noiseFloor, EPSILON) : NaN,
    frequencyHz: firstPeak.frequencyHz,
    power: firstPeak.psd
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
  const params = normalizeSpectralOptions(values, { segmentLength: 256, overlapRatio: 0.75, ...options });
  const window = makeWindow(params.windowType, params.segmentLength);
  const windowEnergy = window.reduce((sum, value) => sum + value * value, 0);
  const binCount = Math.floor(params.segmentLength / 2) + 1;
  const allFrequencies = new Float64Array(binCount);
  for (let k = 0; k < binCount; k += 1) allFrequencies[k] = k * params.sampleRateHz / params.segmentLength;
  const frequencyIndices = [];
  const frequencyBins = [];
  for (let k = 0; k < binCount; k += 1) {
    if (allFrequencies[k] >= params.minHz - 1e-12 && allFrequencies[k] <= params.maxHz + 1e-12) {
      frequencyIndices.push(k);
      frequencyBins.push(allFrequencies[k]);
    }
  }

  const timeBins = [];
  const powerMatrix = [];
  const peaksByTime = [];
  for (const start of segmentStarts(values?.length || 0, params.segmentLength, params.stepSamples)) {
    const time = (start + params.segmentLength / 2) / params.sampleRateHz;
    timeBins.push(time);
    const prepared = prepareSegment(values, start, params.segmentLength, params);
    if (!prepared) {
      powerMatrix.push(frequencyBins.map(() => NaN));
      peaksByTime.push({ timeSeconds: time, frequencyHz: NaN, power: NaN });
      continue;
    }
    for (let i = 0; i < prepared.length; i += 1) prepared[i] *= window[i];
    const spectrum = fftReal(prepared);
    const row = [];
    let best = { frequencyHz: NaN, power: -Infinity };
    for (const k of frequencyIndices) {
      let scale = 1 / (params.sampleRateHz * windowEnergy);
      if (k > 0 && k < params.segmentLength / 2) scale *= 2;
      let power = (spectrum.re[k] * spectrum.re[k] + spectrum.im[k] * spectrum.im[k]) * scale;
      if (params.scale === "log") power = 10 * Math.log10(Math.max(power, EPSILON));
      row.push(power);
      if (power > best.power) best = { frequencyHz: allFrequencies[k], power };
    }
    powerMatrix.push(row);
    peaksByTime.push({ timeSeconds: time, ...best });
  }

  return {
    method: "stft-spectrogram",
    units: params.scale === "log" ? "dB(Hz^2/Hz)" : "Hz^2/Hz",
    timeBins,
    frequencyBins,
    powerMatrix,
    peaksByTime,
    segmentLength: params.segmentLength,
    overlapSamples: params.overlapSamples,
    overlapRatio: params.overlapRatio,
    windowType: params.windowType,
    sampleRateHz: params.sampleRateHz,
    scale: params.scale
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

function computeWelchCrossSpectra(a, b, options = {}) {
  const n = Math.min(a?.length || 0, b?.length || 0);
  const params = normalizeSpectralOptions({ length: n }, options);
  const window = makeWindow(params.windowType, params.segmentLength);
  const windowEnergy = window.reduce((sum, value) => sum + value * value, 0);
  const binCount = Math.floor(params.segmentLength / 2) + 1;
  const pxxAll = new Float64Array(binCount);
  const pyyAll = new Float64Array(binCount);
  const pxyReAll = new Float64Array(binCount);
  const pxyImAll = new Float64Array(binCount);
  let segmentCount = 0;

  for (const start of segmentStarts(n, params.segmentLength, params.stepSamples)) {
    const x = prepareSegment(a, start, params.segmentLength, params);
    const y = prepareSegment(b, start, params.segmentLength, params);
    if (!x || !y) continue;
    for (let i = 0; i < params.segmentLength; i += 1) {
      x[i] *= window[i];
      y[i] *= window[i];
    }
    const sx = fftReal(x);
    const sy = fftReal(y);
    for (let k = 0; k < binCount; k += 1) {
      let scale = 1 / (params.sampleRateHz * windowEnergy);
      if (k > 0 && k < params.segmentLength / 2) scale *= 2;
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
    const f = k * params.sampleRateHz / params.segmentLength;
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

function normalizeSpectralOptions(values, options) {
  const n = values?.length || 0;
  const sampleRateHz = Number(options.sampleRateHz || DEFAULT_SAMPLE_RATE_HZ);
  const requested = Math.max(8, Math.min(Number(options.segmentLength || 256), Math.max(8, n || 8)));
  const segmentLength = isPowerOfTwo(requested) ? requested : previousPowerOfTwo(requested);
  const overlapRatio = clamp(Number(options.overlapRatio ?? 0.5), 0, 0.95);
  const overlapSamples = Math.min(segmentLength - 1, Math.max(0, Math.round(options.overlapSamples ?? segmentLength * overlapRatio)));
  return {
    sampleRateHz,
    segmentLength,
    overlapRatio: overlapSamples / segmentLength,
    overlapSamples,
    stepSamples: Math.max(1, segmentLength - overlapSamples),
    windowType: options.windowType || "hann",
    detrend: options.detrend ?? "constant",
    minHz: Number(options.minHz ?? 0),
    maxHz: Number(options.maxHz ?? sampleRateHz / 2),
    maxPeaks: Math.max(1, Number(options.maxPeaks ?? 5)),
    minValidRatio: Number(options.minValidRatio ?? 0.75),
    bands: options.bands || [{ name: "selected", minHz: Number(options.minHz ?? 0), maxHz: Number(options.maxHz ?? sampleRateHz / 2) }],
    scale: options.scale || "linear"
  };
}

function prepareSegment(values, start, length, params) {
  let count = 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const value = Number(values?.[start + i]);
    if (Number.isFinite(value)) {
      count += 1;
      sum += value;
    }
  }
  if (count / length < params.minValidRatio) return null;
  const mean = count ? sum / count : 0;
  const out = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    const value = Number(values?.[start + i]);
    out[i] = Number.isFinite(value) ? value : mean;
  }
  if (params.detrend === false || params.detrend === "none") return out;
  if (params.detrend === "linear") removeLinearTrend(out);
  else {
    for (let i = 0; i < out.length; i += 1) out[i] -= mean;
  }
  return out;
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
      peaks.push({ frequencyHz: frequencies[i], value: values[i] });
    }
  }
  if (!peaks.length && values.length) {
    const index = values.reduce((best, value, i) => value > values[best] ? i : best, 0);
    peaks.push({ frequencyHz: frequencies[index], value: values[index] });
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

function emptyPsd(params) {
  return {
    method: "welch-psd",
    units: "Hz^2/Hz",
    sampleRateHz: params.sampleRateHz,
    segmentLength: params.segmentLength,
    overlapSamples: params.overlapSamples,
    overlapRatio: params.overlapRatio,
    windowType: params.windowType,
    detrend: params.detrend,
    segmentCount: 0,
    frequencies: [],
    psd: [],
    allFrequencies: [],
    allPsd: [],
    peaks: [],
    bandEnergies: [],
    noiseFloor: NaN,
    snr: NaN,
    frequencyHz: NaN,
    power: NaN
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

function thresholdEvents(series, threshold, minEventSeconds, sampleIntervalSeconds, values = [], startSecond = 0) {
  const events = [];
  let start = null;
  let side = null;
  let peak = 0;
  const limit = Math.abs(Number(threshold) || 0);
  const closeRun = endIndex => {
    if (start === null || !side) return;
    const durationSeconds = (endIndex - start + 1) * sampleIntervalSeconds;
    if (durationSeconds >= minEventSeconds) {
      const frequencyStats = rocofFrequencyStats(values, start, endIndex, sampleIntervalSeconds, startSecond);
      events.push({
        type: "rocof",
        eventType: "rocof",
        side,
        startSecond: startSecond + start * sampleIntervalSeconds,
        endSecond: startSecond + (endIndex + 1) * sampleIntervalSeconds,
        durationSeconds,
        peakHzPerSecond: peak,
        peakMhzPerSecond: peak * 1000,
        value: peak,
        classification: side,
        shortLabel: side === "positive" ? "R+" : "R-",
        ...frequencyStats
      });
    }
    start = null;
    side = null;
    peak = 0;
  };
  for (let i = 0; i <= series.length; i += 1) {
    const value = series[i];
    const currentSide = Number.isFinite(value)
      ? value > limit ? "positive" : value < -limit ? "negative" : null
      : null;
    if (currentSide && start === null) {
      start = i;
      side = currentSide;
      peak = value;
      continue;
    }
    if (currentSide && currentSide === side) {
      if (side === "positive" ? value > peak : value < peak) peak = value;
      continue;
    }
    if (currentSide && currentSide !== side) {
      closeRun(i - 1);
      start = i;
      side = currentSide;
      peak = value;
      continue;
    }
    closeRun(i - 1);
  }
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
  computeCrossPowerSpectralDensity,
  computeMagnitudeSquaredCoherence,
  computeOscillationConfidence,
  computeRocof,
  computeStftSpectrogram,
  computeWelchPsd,
  createSyntheticSignal,
  dominantFrequencyScan,
  estimateCoherence,
  estimateDominantFrequency,
  estimatePhaseDifference
};

globalThis.FrequencyAnalysisCore = FrequencyAnalysisCore;
