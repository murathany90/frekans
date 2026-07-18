import { describe, expect, it } from "vitest";
import {
  CHUNK_SECONDS,
  buildChunks,
  chunkStartMs,
  createEmptyChunkBuffers,
  filterSamplesForRetention,
  sampleIndexInChunk,
  setChunkSample,
  summarizeChunk
} from "../src/frequency-store";

const chunkStart = Date.parse("2026-07-18T00:00:00.000Z");

describe("15 minute frequency chunks", () => {
  it("computes chunk start and second index", () => {
    expect(CHUNK_SECONDS).toBe(900);
    expect(chunkStartMs(chunkStart + 899_999)).toBe(chunkStart);
    expect(chunkStartMs(chunkStart + 900_000)).toBe(chunkStart + 900_000);
    expect(sampleIndexInChunk(chunkStart + 12_345, chunkStart)).toBe(12);
  });

  it("stores duplicate seconds in the same cell and updates statistics", () => {
    const chunk = createEmptyChunkBuffers(chunkStart);
    setChunkSample(chunk, { timestampMs: chunkStart + 5000, frequencyHz: 49.9985 });
    setChunkSample(chunk, { timestampMs: chunkStart + 5250, frequencyHz: 50.0214 });
    const summary = summarizeChunk(chunk);

    expect(summary.sampleCount).toBe(1);
    expect(summary.minValue).toBe(214);
    expect(summary.maxValue).toBe(214);
    expect(summary.sumValue).toBe(214);
    expect(chunk.samples[5]).toBe(214);
    expect((chunk.validityBitmap[0] & (1 << 5)) !== 0).toBe(true);
  });

  it("builds multiple chunks from sorted samples", () => {
    const chunks = buildChunks([
      { timestampMs: chunkStart + 1000, frequencyHz: 50.0 },
      { timestampMs: chunkStart + 901_000, frequencyHz: 49.999 }
    ]);

    expect([...chunks.keys()]).toEqual([chunkStart, chunkStart + 900_000]);
    expect(summarizeChunk(chunks.get(chunkStart)!).sampleCount).toBe(1);
    expect(summarizeChunk(chunks.get(chunkStart + 900_000)!).sampleCount).toBe(1);
  });

  it("keeps only measurements within the 24 hour retention window", () => {
    const now = chunkStart + 86_400_000;
    const samples = filterSamplesForRetention(
      [
        { timestampMs: now - 86_400_001, frequencyHz: 50 },
        { timestampMs: now - 86_400_000, frequencyHz: 50.001 },
        { timestampMs: now, frequencyHz: 49.999 }
      ],
      now
    );

    expect(samples.map((sample) => sample.frequencyHz)).toEqual([50.001, 49.999]);
  });
});
