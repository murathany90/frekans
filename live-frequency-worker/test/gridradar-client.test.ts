import { describe, expect, it } from "vitest";
import { parseGridRadarJson } from "../src/gridradar-client";

const ts = Date.parse("2026-07-18T00:00:00.000Z");

describe("parseGridRadarJson", () => {
  it("parses Grafana datapoints as value/timestamp pairs", () => {
    const result = parseGridRadarJson({
      datapoints: [
        [49.9985, "2026-07-18T00:00:00.000Z"],
        [50.0214, "2026-07-18T00:00:01.000Z"]
      ]
    });

    expect(result.samples).toEqual([
      { timestampMs: ts, frequencyHz: 49.9985 },
      { timestampMs: ts + 1000, frequencyHz: 50.0214 }
    ]);
    expect(result.rejected).toEqual([]);
  });

  it("parses data arrays with timestamp/value objects", () => {
    const result = parseGridRadarJson({
      data: [
        { timestamp: "2026-07-18T00:00:00Z", value: "50.0001" },
        { ts: ts + 1000, frequency: 49.9999 }
      ]
    });

    expect(result.samples.map((sample) => sample.frequencyHz)).toEqual([50.0001, 49.9999]);
  });

  it("parses numeric timestamp/value pairs in both orders", () => {
    const result = parseGridRadarJson({
      data: [
        [ts, 50.0012],
        [49.9975, ts + 1000]
      ]
    });

    expect(result.samples).toEqual([
      { timestampMs: ts, frequencyHz: 50.0012 },
      { timestampMs: ts + 1000, frequencyHz: 49.9975 }
    ]);
  });

  it("deduplicates repeated seconds and keeps the newest value", () => {
    const result = parseGridRadarJson({
      data: [
        [ts, 50.0001],
        [ts + 250, 50.0004],
        [ts + 1000, 49.9998]
      ]
    });

    expect(result.samples).toEqual([
      { timestampMs: ts, frequencyHz: 50.0004 },
      { timestampMs: ts + 1000, frequencyHz: 49.9998 }
    ]);
  });

  it("handles empty and malformed payloads without throwing", () => {
    expect(parseGridRadarJson({ data: [] }).samples).toEqual([]);
    const malformed = parseGridRadarJson("{not valid json");
    expect(malformed.samples).toEqual([]);
    expect(malformed.rejected.some((item) => item.reason === "invalid-json")).toBe(true);
  });

  it("rejects invalid frequency and timestamp values", () => {
    const result = parseGridRadarJson({
      data: [
        ["2026-07-18T00:00:00Z", 60],
        ["not-a-date", 50.001],
        ["2026-07-18T00:00:02Z", 50.002]
      ]
    });

    expect(result.samples).toEqual([{ timestampMs: ts + 2000, frequencyHz: 50.002 }]);
    expect(result.rejected.map((item) => item.reason)).toEqual(["invalid-frequency", "invalid-timestamp"]);
  });
});
