import { describe, expect, it } from "vitest";
import { decodeFrequencyValue, encodeFrequencyHz } from "../src/encoding";

describe("frequency int16 encoding", () => {
  it("encodes GridFreq live frequency values around 50 Hz", () => {
    expect(encodeFrequencyHz(50.0)).toBe(0);
    expect(encodeFrequencyHz(49.9985)).toBe(-15);
    expect(encodeFrequencyHz(50.0214)).toBe(214);
  });

  it("decodes encoded values back to Hertz", () => {
    expect(decodeFrequencyValue(0)).toBe(50);
    expect(decodeFrequencyValue(-15)).toBe(49.9985);
    expect(decodeFrequencyValue(214)).toBe(50.0214);
  });

  it("rejects values outside signed Int16 storage range", () => {
    expect(encodeFrequencyHz(53.2767)).toBe(32767);
    expect(encodeFrequencyHz(46.7232)).toBe(-32768);
    expect(() => encodeFrequencyHz(53.2768)).toThrow(/Int16/);
    expect(() => encodeFrequencyHz(46.7231)).toThrow(/Int16/);
  });

  it("round trips valid encoded values", () => {
    for (const value of [49.95, 49.9985, 50, 50.0214, 50.08]) {
      expect(decodeFrequencyValue(encodeFrequencyHz(value))).toBeCloseTo(value, 4);
    }
  });
});
