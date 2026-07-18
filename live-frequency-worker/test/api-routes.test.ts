import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../src/api-routes";
import type { Env, FrequencyStoreApi } from "../src/types";

const env = {
  ALLOWED_ORIGINS: "https://gridfreq.com,https://www.gridfreq.com",
  GRIDRADAR_METRIC: "frequency-ucte-median-1s",
  RETENTION_SECONDS: "86400"
} as Env;

const store: FrequencyStoreApi = {
  getHealth: async () => ({ collector: "healthy", dataAvailable: true }),
  getStatus: async () => ({
    status: "healthy",
    source: "GridRadar",
    metric: "frequency-ucte-median-1s",
    nominalFrequencyHz: 50,
    latestFrequencyHz: 49.9987,
    latestMeasurementTime: "2026-07-18T00:00:00.000Z",
    lastCollectionTime: "2026-07-18T00:15:10.000Z",
    sourceDelaySeconds: 910,
    collectorDelaySeconds: 10,
    resolutionSeconds: 1,
    retentionHours: 24,
    availableHistorySeconds: 3600,
    validSampleRatio: 1
  }),
  getMinuteSeries: async () => [
    { timestamp: "2026-07-18T00:00:00.000Z", meanHz: 50, minHz: 49.99, maxHz: 50.01, validSamples: 60 }
  ],
  getRawSeries: async () => [{ timestampMs: Date.parse("2026-07-18T00:00:00Z"), frequencyHz: 50 }],
  getDelta: async () => [{ timestampMs: Date.parse("2026-07-18T00:00:01Z"), frequencyHz: 50.001 }]
};

describe("public API routes", () => {
  it("serves health with safe CORS headers", async () => {
    const response = await handleApiRequest(
      new Request("https://worker.example/health", { headers: { Origin: "https://gridfreq.com" } }),
      store,
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://gridfreq.com");
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toMatchObject({ service: "gridfreq-live-api", worker: "ok" });
  });

  it("rejects disallowed origins without reflecting them", async () => {
    const response = await handleApiRequest(
      new Request("https://worker.example/v1/live/status", { headers: { Origin: "https://evil.example" } }),
      store,
      env
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("handles OPTIONS preflight", async () => {
    const response = await handleApiRequest(
      new Request("https://worker.example/v1/live/status", {
        method: "OPTIONS",
        headers: { Origin: "https://gridfreq.com" }
      }),
      store,
      env
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("serves status metadata with the GridRadar source contract", async () => {
    const response = await handleApiRequest(
      new Request("https://worker.example/v1/live/status", { headers: { Origin: "https://gridfreq.com" } }),
      store,
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      source: "GridRadar",
      metric: "frequency-ucte-median-1s",
      resolutionSeconds: 1,
      retentionHours: 24
    });
  });

  it("rejects raw one second series longer than one hour", async () => {
    const response = await handleApiRequest(
      new Request("https://worker.example/v1/live/series?from=2026-07-18T00:00:00Z&to=2026-07-18T02:00:01Z&resolution=1s", {
        headers: { Origin: "https://gridfreq.com" }
      }),
      store,
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "range-too-large" });
  });

  it("does not expose a 24 hour raw one second series shortcut", async () => {
    const response = await handleApiRequest(
      new Request("https://worker.example/v1/live/series?range=24h&resolution=1s", {
        headers: { Origin: "https://gridfreq.com" }
      }),
      store,
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid-from-to" });
  });

  it("marks delta as no-store", async () => {
    const response = await handleApiRequest(
      new Request("https://worker.example/v1/live/delta?after=0", { headers: { Origin: "https://gridfreq.com" } }),
      store,
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
