import assert from "node:assert/strict";
import {
  DEFAULT_ROCOF_PARAMETERS,
  computeRocof,
  hzPerSecondToMhzPerSecond,
  mHzPerSecondToHzPerSecond,
  normalizeRocofParameters
} from "../assets/analysis-core.mjs";

function assertNaN(value, message) {
  assert(Number.isNaN(Number(value)), message);
}

function rampSeries(length = 80, slopeHzPerSecond = 0.02) {
  return Array.from({ length }, (_, index) => 50 + index * slopeHzPerSecond);
}

assert.deepEqual(DEFAULT_ROCOF_PARAMETERS, {
  method: "central",
  sampleIntervalSeconds: 1,
  thresholdHzPerSecond: 0.01,
  minEventSeconds: 5,
  preFilterSeconds: 5,
  windowSeconds: 5
});

assert.equal(mHzPerSecondToHzPerSecond(2), 0.002, "UI mHz/s threshold should convert to engine Hz/s.");
assert.equal(hzPerSecondToMhzPerSecond(0.002), 2, "Engine Hz/s threshold should convert to display mHz/s.");

const defaultParams = normalizeRocofParameters({});
assert.deepEqual(
  {
    method: defaultParams.method,
    sampleIntervalSeconds: defaultParams.sampleIntervalSeconds,
    thresholdHzPerSecond: defaultParams.thresholdHzPerSecond,
    minEventSeconds: defaultParams.minEventSeconds,
    preFilterSeconds: defaultParams.preFilterSeconds,
    windowSeconds: defaultParams.windowSeconds
  },
  DEFAULT_ROCOF_PARAMETERS,
  "Missing saved RoCoF parameters should be filled from the central default contract."
);

const defaultRocof = computeRocof(rampSeries(12));
assert.equal(defaultRocof.parameters.minEventSeconds, 5, "computeRocof should use the shared 5-second default minimum event duration.");
assert.equal(defaultRocof.parameters.windowSeconds, 5, "computeRocof should expose shared default regression window.");
assert.equal(defaultRocof.parameters.preFilterSeconds, 5, "computeRocof should expose shared default pre-filter window.");

const cleanCentral = computeRocof(rampSeries(), {
  method: "central",
  sampleIntervalSeconds: 1,
  thresholdHzPerSecond: 0.01,
  minEventSeconds: 2
});
assert(cleanCentral.maxPositive > 0.019, "Central difference should compute positive RoCoF on clean 1s data.");
assert(cleanCentral.events.some(event => event.side === "positive"), "Positive RoCoF events should carry side=positive.");

const centralGap = rampSeries();
centralGap[30] = NaN;
const centralWithGap = computeRocof(centralGap, { method: "central", sampleIntervalSeconds: 1 });
assertNaN(centralWithGap.series[29], "Central difference must not bridge a missing next neighbor.");
assertNaN(centralWithGap.series[30], "Central difference must not compute when the center sample is bad quality.");
assertNaN(centralWithGap.series[31], "Central difference must not bridge a missing previous neighbor.");
assert.equal(centralWithGap.originalValidCount, 79, "Central original valid count should ignore only the bad source sample.");
assert.equal(centralWithGap.calculatedCount, 75, "Central calculated count should include only finite RoCoF samples.");
assert.equal(centralWithGap.rocofCalculatedCount, centralWithGap.calculatedCount, "Legacy rocofCalculatedCount should match calculatedCount.");
assert.equal(centralWithGap.edgeDiscardCount, 2, "Central edge discards should be counted separately.");
assert.equal(centralWithGap.qualityGapDiscardCount, 2, "Central gap-neighbor discards should be counted separately.");
assert.equal(centralWithGap.filterWindowDiscardCount, 0, "Central should not report filter window discards.");
assert.equal(centralWithGap.regressionWindowDiscardCount, 0, "Central should not report regression window discards.");
assert.equal(
  centralWithGap.edgeDiscardCount + centralWithGap.qualityGapDiscardCount + centralWithGap.filterWindowDiscardCount + centralWithGap.regressionWindowDiscardCount,
  centralWithGap.methodDiscardCount,
  "Discard counters should add up to the legacy methodDiscardCount."
);

const filteredGap = rampSeries();
filteredGap[30] = NaN;
const filteredWithGap = computeRocof(filteredGap, {
  method: "filteredDerivative",
  sampleIntervalSeconds: 1,
  preFilterSeconds: 5,
  thresholdHzPerSecond: 0.01
});
for (let index = 27; index <= 33; index += 1) {
  assertNaN(filteredWithGap.series[index], `Filtered derivative must not bridge a quality gap at index ${index}.`);
}
assert.equal(filteredWithGap.requestedPreFilterSeconds, 5, "Filtered derivative should report requested pre-filter seconds.");
assert.equal(filteredWithGap.effectivePreFilterSamples, 5, "Filtered derivative should report effective odd pre-filter samples.");
assert.equal(filteredWithGap.effectivePreFilterSeconds, 5, "Filtered derivative should report effective pre-filter seconds.");
assert.equal(filteredWithGap.filterWindowDiscardCount, 8, "Filtered derivative should count filter-window edge and gap discards.");

const regressionGap = rampSeries();
regressionGap[30] = NaN;
const regressionWithGap = computeRocof(regressionGap, {
  method: "movingRegression",
  sampleIntervalSeconds: 1,
  windowSeconds: 7,
  thresholdHzPerSecond: 0.01
});
for (let index = 27; index <= 33; index += 1) {
  assertNaN(regressionWithGap.series[index], `Moving regression must not regress across a quality gap at index ${index}.`);
}
assert.equal(regressionWithGap.requestedWindowSeconds, 7, "Moving regression should report requested window seconds.");
assert.equal(regressionWithGap.effectiveWindowSamples, 7, "Moving regression should report effective odd window samples.");
assert.equal(regressionWithGap.effectiveWindowSeconds, 7, "Moving regression should report effective window seconds.");
assert.equal(regressionWithGap.edgeDiscardCount, 6, "Moving regression should count edge samples separately.");
assert.equal(regressionWithGap.regressionWindowDiscardCount, 6, "Moving regression should count window samples blocked by quality gaps.");

const evenWindow = computeRocof(rampSeries(20), {
  method: "movingRegression",
  sampleIntervalSeconds: 1,
  windowSeconds: 4
});
assert.equal(evenWindow.requestedWindowSeconds, 4, "Requested even regression window should be preserved.");
assert.equal(evenWindow.effectiveWindowSamples, 5, "Requested 4s regression window at 1s dt should become an effective 5-sample window.");
assert.equal(evenWindow.effectiveWindowSeconds, 5, "Effective regression window seconds should be visible.");

const evenPrefilter = computeRocof(rampSeries(20), {
  method: "filteredDerivative",
  sampleIntervalSeconds: 1,
  preFilterSeconds: 4
});
assert.equal(evenPrefilter.requestedPreFilterSeconds, 4, "Requested even pre-filter window should be preserved.");
assert.equal(evenPrefilter.effectivePreFilterSamples, 5, "Requested 4s pre-filter at 1s dt should become an effective 5-sample window.");
assert.equal(evenPrefilter.effectivePreFilterSeconds, 5, "Effective pre-filter window seconds should be visible.");

const eventSeries = Array.from({ length: 80 }, () => 50);
for (let index = 10; index < 22; index += 1) eventSeries[index] = 50 + (index - 9) * 0.02;
for (let index = 40; index < 52; index += 1) eventSeries[index] = 50.30 - (index - 39) * 0.02;
eventSeries[22] = NaN;
eventSeries[39] = NaN;
const signedEvents = computeRocof(eventSeries, {
  method: "central",
  sampleIntervalSeconds: 1,
  thresholdHzPerSecond: 0.01,
  minEventSeconds: 2
});
assert(signedEvents.events.some(event => event.side === "positive"), "R+ events should be separate from R- events.");
assert(signedEvents.events.some(event => event.side === "negative"), "R- events should be separate from R+ events.");
assert(signedEvents.events.every(event => event.eventType === "rocof"), "RoCoF threshold events should be typed.");
assert(signedEvents.events.every(event => Number.isFinite(event.startFrequencyHz)), "RoCoF events should retain start frequency.");
assert(signedEvents.events.every(event => Number.isFinite(event.endFrequencyHz)), "RoCoF events should retain end frequency.");
assert(signedEvents.events.every(event => Number.isFinite(event.minFrequencyHz)), "RoCoF events should retain minimum frequency.");
assert(signedEvents.events.every(event => Number.isFinite(event.maxFrequencyHz)), "RoCoF events should retain maximum frequency.");
assert(
  signedEvents.events.find(event => event.side === "positive").endSecond <= 23,
  "Bad quality gap should stop the positive RoCoF event instead of merging across it."
);

const exactPositive = computeRocof([50, 50.01], { method: "simple", thresholdHzPerSecond: 0.01, minEventSeconds: 1 });
assert.equal(exactPositive.events.length, 0, "value === +threshold should not start an event.");
const abovePositive = computeRocof([50, 50.0101], { method: "simple", thresholdHzPerSecond: 0.01, minEventSeconds: 1 });
assert.equal(abovePositive.events[0]?.side, "positive", "value > +threshold should start a positive event.");
const exactNegative = computeRocof([50, 49.99], { method: "simple", thresholdHzPerSecond: 0.01, minEventSeconds: 1 });
assert.equal(exactNegative.events.length, 0, "value === -threshold should not start an event.");
const belowNegative = computeRocof([50, 49.9899], { method: "simple", thresholdHzPerSecond: 0.01, minEventSeconds: 1 });
assert.equal(belowNegative.events[0]?.side, "negative", "value < -threshold should start a negative event.");

function frequencyFromSimpleRocof(increments) {
  const values = [50];
  for (const increment of increments) {
    const previous = values.at(-1);
    values.push(Number.isFinite(increment) && Number.isFinite(previous) ? previous + increment : NaN);
  }
  return values;
}

const hysteresisNoise = computeRocof(frequencyFromSimpleRocof([0.012, 0.008, 0.009, 0.011]), {
  method: "simple",
  thresholdHzPerSecond: 0.01,
  hysteresisEnabled: true,
  enterThresholdHzPerSecond: 0.01,
  exitThresholdHzPerSecond: 0.006,
  minEventSeconds: 1
});
assert.equal(hysteresisNoise.events.length, 1, "Hysteresis should keep threshold-edge noise in one event.");
assert.equal(hysteresisNoise.events[0].durationSeconds, 4, "Hysteresis event should include samples until the exit threshold is crossed.");

const signChange = computeRocof(frequencyFromSimpleRocof([0.012, 0.008, -0.012, -0.011]), {
  method: "simple",
  thresholdHzPerSecond: 0.01,
  hysteresisEnabled: true,
  enterThresholdHzPerSecond: 0.01,
  exitThresholdHzPerSecond: 0.006,
  minEventSeconds: 1
});
assert.deepEqual(signChange.events.map(event => event.side), ["positive", "negative"], "Sign changes should split R+ and R- events.");

const finiteMerge = computeRocof(frequencyFromSimpleRocof([0.012, 0.008, 0.012]), {
  method: "simple",
  thresholdHzPerSecond: 0.01,
  mergeGapSeconds: 1,
  minEventSeconds: 1
});
assert.equal(finiteMerge.events.length, 1, "mergeGapSeconds should merge across a short finite below-threshold gap.");
assert.equal(finiteMerge.events[0].durationSeconds, 3, "Merged event should expose the effective merged duration.");

const missingMergeBlocked = computeRocof([50, 50.012, NaN, 50.024, 50.036], {
  method: "simple",
  thresholdHzPerSecond: 0.01,
  mergeGapSeconds: 3,
  minEventSeconds: 1
});
assert.equal(missingMergeBlocked.events.length, 2, "Missing data gaps should not be merged even when mergeGapSeconds is large.");

console.log("rocof_quality_core ok");
