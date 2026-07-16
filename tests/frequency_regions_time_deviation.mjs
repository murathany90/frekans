import { strict as assert } from "node:assert";
import { calculateElectricalTimeDeviation, formatSignedSeconds } from "../assets/frequency-regions.mjs";

{
  const result = calculateElectricalTimeDeviation([49.99, 50.01, 50.00], {
    nominalFrequencyHz: 50,
    sampleIntervalSeconds: 1
  });
  assert.ok(Math.abs(result.seconds) < 1e-9, "balanced frequency deviations should cancel out");
  assert.equal(result.validSamples, 3);
  assert.equal(result.coverageRatio, 1);
  assert.equal(result.confidence, "high");
}

{
  const result = calculateElectricalTimeDeviation([49.99, 49.99], {
    nominalFrequencyHz: 50,
    sampleIntervalSeconds: 1
  });
  assert.ok(Math.abs(result.seconds - -0.0004) < 1e-10, "time deviation should accumulate delta f / f0 over duration");
}

{
  const result = calculateElectricalTimeDeviation([
    { frequencyHz: 49.98, durationSeconds: 1 },
    { frequencyHz: Number.NaN, durationSeconds: 2 },
    { frequencyHz: 50.02, durationSeconds: 1 }
  ], { nominalFrequencyHz: 50 });
  assert.equal(result.validSamples, 2);
  assert.equal(result.skippedSamples, 1);
  assert.equal(result.totalDurationSeconds, 4);
  assert.equal(result.validDurationSeconds, 2);
  assert.equal(result.coverageRatio, 0.5);
  assert.equal(result.confidence, "low");
}

{
  const result = calculateElectricalTimeDeviation([], { nominalFrequencyHz: 50 });
  assert.equal(result.seconds, null);
  assert.equal(result.confidence, "none");
}

assert.equal(formatSignedSeconds(1.234), "+1.234 s");
assert.equal(formatSignedSeconds(-0.25), "-0.250 s");
assert.equal(formatSignedSeconds(null), "—");

console.log("frequency_regions_time_deviation ok");
