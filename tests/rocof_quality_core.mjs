import assert from "node:assert/strict";
import { computeRocof } from "../assets/analysis-core.mjs";

function assertNaN(value, message) {
  assert(Number.isNaN(Number(value)), message);
}

function rampSeries(length = 80, slopeHzPerSecond = 0.02) {
  return Array.from({ length }, (_, index) => 50 + index * slopeHzPerSecond);
}

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

console.log("rocof_quality_core ok");
