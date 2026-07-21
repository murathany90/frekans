import assert from "node:assert/strict";
import {
  DEFAULT_DAILY_TREND_PARAMETERS,
  computeDailyFrequencyTrend
} from "../assets/analysis-core.mjs";

function assertNear(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
}

function makeTimestamps(startEpochMs, count, stepSeconds = 1) {
  return Array.from({ length: count }, (_, index) => startEpochMs + index * stepSeconds * 1000);
}

assert.equal(DEFAULT_DAILY_TREND_PARAMETERS.sampleIntervalSeconds, 1);
assert.equal(DEFAULT_DAILY_TREND_PARAMETERS.requestedResolution, "auto");
assert.equal(DEFAULT_DAILY_TREND_PARAMETERS.histogramNormalization, "percent");

{
  const start = Date.UTC(2026, 0, 1, 0, 0, 0);
  const values = [50.00, 50.01, NaN, 49.99, 50.02, 49.98];
  const result = computeDailyFrequencyTrend(values, makeTimestamps(start, values.length), {
    requestedResolution: "1s",
    histogramBinWidthHz: 0.01,
    timeZone: "UTC",
    maxChartPoints: 100
  });
  assert.equal(result.dailyStats.length, 1);
  assert.equal(result.requestedResolution, "1s");
  assert.equal(result.effectiveResolution, "1s");
  assert.equal(result.chart.points.length, values.length);
  assert.equal(result.chart.points[2].meanHz, null, "missing seconds must stay empty, not 50 Hz");
  assert.equal(result.dailyStats[0].validSampleCount, 5);
  assert.equal(result.dailyStats[0].missingSampleCount, 1);
  assert.equal(result.dailyStats[0].maxFrequencyHz, 50.02);
  assert.equal(result.dailyStats[0].maxTimestampMs, start + 4_000);
  assert.equal(result.dailyStats[0].minFrequencyHz, 49.98);
  assert.equal(result.dailyStats[0].minTimestampMs, start + 5_000);
  assertNear(result.histogram.totalPercent, 100, 1e-9, "histogram percent total");
}

{
  const start = Date.UTC(2026, 0, 2, 0, 0, 0);
  const values = Array.from({ length: 3600 }, (_, index) => {
    const minuteValue = Math.floor(index / 60);
    return 50 + minuteValue * 0.001 + (index % 60 === 0 ? 0.002 : 0);
  });
  const result = computeDailyFrequencyTrend(values, makeTimestamps(start, values.length), {
    requestedResolution: "1m",
    timeZone: "UTC",
    maxChartPoints: 5000
  });
  assert.equal(result.effectiveResolution, "1m");
  assert.equal(result.chart.points.length, 60);
  assertNear(result.chart.points[0].meanHz, 50 + 0.002 / 60, 1e-9, "first minute mean");
  assert.equal(result.chart.points[0].minHz, 50);
  assert.equal(result.chart.points[0].maxHz, 50.002);

  const quarter = computeDailyFrequencyTrend(values, makeTimestamps(start, values.length), {
    requestedResolution: "15m",
    timeZone: "UTC"
  });
  assert.equal(quarter.effectiveResolution, "15m");
  assert.equal(quarter.chart.points.length, 4);
  assertNear(quarter.chart.points[1].minHz, 50.015, 1e-12, "15-minute bucket min");

  const hourly = computeDailyFrequencyTrend(values, makeTimestamps(start, values.length), {
    requestedResolution: "1h",
    timeZone: "UTC"
  });
  assert.equal(hourly.effectiveResolution, "1h");
  assert.equal(hourly.chart.points.length, 1);
  assert.equal(hourly.chart.points[0].validCount, 3600);
}

{
  const values = [];
  const timestamps = [];
  for (let day = 0; day < 3; day += 1) {
    const start = Date.UTC(2026, 0, 3 + day, 0, 0, 0);
    for (let index = 0; index < 120; index += 1) {
      values.push(50 + day * 0.001);
      timestamps.push(start + index * 1000);
    }
  }
  const result = computeDailyFrequencyTrend(values, timestamps, {
    requestedResolution: "auto",
    maxChartPoints: 10_000,
    minimumDailyCoverageRatio: 0.75,
    timeZone: "UTC"
  });
  assert.equal(result.dailyStats.length, 3);
  assertNear(result.dailyStats[1].meanDeltaMhz, 1, 1e-9, "mean delta");
  assertNear(result.dailyStats[2].movingAverage3MeanHz, 50.001, 1e-12, "3-day moving average");
  assertNear(result.trendSlopesMhzPerDay.mean, 1, 1e-9, "3-day mean trend slope");
}

{
  const start = Date.UTC(2026, 0, 10, 0, 0, 0);
  const values = Array.from({ length: 100 }, (_, index) => (index < 50 ? 50.0 : NaN));
  const result = computeDailyFrequencyTrend(values, makeTimestamps(start, values.length), {
    minimumDailyCoverageRatio: 0.75,
    timeZone: "UTC"
  });
  assert.equal(result.dailyStats[0].status, "low_coverage");
  assert.equal(result.dailyStats[0].coverageRatio, 0.5);
}

{
  const springStartUtc = Date.parse("2026-03-28T23:00:00Z");
  const fallStartUtc = Date.parse("2026-10-24T22:00:00Z");
  const springCount = 82_800;
  const fallCount = 90_000;
  const values = [
    ...Array.from({ length: springCount }, () => 50.0),
    ...Array.from({ length: fallCount }, () => 50.001)
  ];
  const timestamps = [
    ...makeTimestamps(springStartUtc, springCount),
    ...makeTimestamps(fallStartUtc, fallCount)
  ];
  const result = computeDailyFrequencyTrend(values, timestamps, { timeZone: "Europe/Berlin" });
  const spring = result.dailyStats.find(day => day.date === "2026-03-29");
  const fall = result.dailyStats.find(day => day.date === "2026-10-25");
  assert.equal(spring.dayLengthSeconds, 82_800);
  assert.equal(fall.dayLengthSeconds, 90_000);
}

console.log("daily_frequency_trend_core ok");
