import { describe, expect, it } from "vitest";
import { nextDelaySecondsForCollectionResult } from "../src/frequency-store";

describe("collector alarm backoff", () => {
  it("uses the normal poll interval after successful collection", () => {
    expect(nextDelaySecondsForCollectionResult({ ok: true, consecutiveRateLimitErrors: 3 })).toBe(60);
  });

  it("backs off token and authorization failures for fifteen minutes", () => {
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 401 })).toBe(900);
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 403 })).toBe(900);
  });

  it("uses exponential-ish backoff for rate limiting", () => {
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 429, consecutiveRateLimitErrors: 1 })).toBe(120);
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 429, consecutiveRateLimitErrors: 2 })).toBe(300);
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 429, consecutiveRateLimitErrors: 3 })).toBe(600);
  });

  it("retries timeout and server errors without hammering the upstream API", () => {
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 408 })).toBe(60);
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 500 })).toBe(300);
    expect(nextDelaySecondsForCollectionResult({ ok: false, status: 0 })).toBe(300);
  });
});
