import { MAX_RAW_RANGE_SECONDS, RETENTION_SECONDS } from "./constants";
import type { Env, FrequencyStoreApi } from "./types";

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

function allowedOrigins(env: Env): Set<string> {
  return new Set((env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean));
}

function isLocalDevOrigin(origin: string, env: Env): boolean {
  if (env.ENVIRONMENT !== "development") return false;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function corsOrigin(request: Request, env: Env): string | null | "denied" {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (allowedOrigins(env).has(origin) || isLocalDevOrigin(origin, env)) return origin;
  return "denied";
}

function baseHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin"
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function jsonResponse(body: unknown, init: ResponseInit & { origin?: string | null; cacheControl?: string } = {}): Response {
  const headers = baseHeaders(init.origin ?? null);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", init.cacheControl || "no-store");
  if (init.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { ...init, headers });
}

function parseDateMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRangeSeconds(value: string | null): number {
  if (value === "15m") return 15 * 60;
  if (value === "1h") return 3600;
  if (value === "6h") return 6 * 3600;
  return RETENTION_SECONDS;
}

async function maybeCache(request: Request, responseFactory: () => Promise<Response>, ctx?: ExecutionContextLike): Promise<Response> {
  if (request.method !== "GET" || new URL(request.url).pathname.includes("/delta") || typeof caches === "undefined") {
    return responseFactory();
  }
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await responseFactory();
  if (response.ok && ctx) ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}

export async function handleApiRequest(
  request: Request,
  store: FrequencyStoreApi,
  env: Env,
  ctx?: ExecutionContextLike
): Promise<Response> {
  const origin = corsOrigin(request, env);
  if (origin === "denied") {
    return jsonResponse({ error: "origin-not-allowed" }, { status: 403 });
  }
  if (request.method === "OPTIONS") {
    const headers = baseHeaders(origin);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
    headers.set("Access-Control-Max-Age", "86400");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "method-not-allowed" }, { status: 405, origin });
  }

  const url = new URL(request.url);
  if (url.pathname === "/health") {
    return maybeCache(
      request,
      async () => jsonResponse({ service: "gridfreq-live-api", worker: "ok", ...(await store.getHealth()) }, { origin, cacheControl: "public, max-age=15" }),
      ctx
    );
  }
  if (url.pathname === "/v1/live/status") {
    return maybeCache(request, async () => jsonResponse(await store.getStatus(), { origin, cacheControl: "public, max-age=15" }), ctx);
  }
  if (url.pathname === "/v1/live/series") {
    const resolution = url.searchParams.get("resolution") || "60s";
    if (resolution === "1s") {
      const fromMs = parseDateMs(url.searchParams.get("from"));
      const toMs = parseDateMs(url.searchParams.get("to"));
      if (fromMs === null || toMs === null || toMs <= fromMs) {
        return jsonResponse({ error: "invalid-from-to" }, { status: 400, origin });
      }
      if (toMs - fromMs > MAX_RAW_RANGE_SECONDS * 1000) {
        return jsonResponse({ error: "range-too-large" }, { status: 400, origin });
      }
      return maybeCache(request, async () => jsonResponse(await store.getRawSeries(fromMs, toMs), { origin, cacheControl: "public, max-age=300" }), ctx);
    }
    const rangeSeconds = parseRangeSeconds(url.searchParams.get("range"));
    const toMs = Date.now();
    const fromMs = toMs - rangeSeconds * 1000;
    return maybeCache(request, async () => jsonResponse(await store.getMinuteSeries(fromMs, toMs), { origin, cacheControl: "public, max-age=30" }), ctx);
  }
  if (url.pathname === "/v1/live/delta") {
    const after = Number(url.searchParams.get("after"));
    if (!Number.isFinite(after) || after < 0) {
      return jsonResponse({ error: "invalid-after" }, { status: 400, origin });
    }
    return jsonResponse(await store.getDelta(after), { origin, cacheControl: "no-store" });
  }
  return jsonResponse({ error: "not-found" }, { status: 404, origin });
}
