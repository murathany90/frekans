import { OBJECT_NAME } from "./constants";
import { handleApiRequest } from "./api-routes";
import { FrequencyStore } from "./frequency-store";
import type { Env, FrequencyStoreApi } from "./types";

export { FrequencyStore };

function objectStub(env: Env): DurableObjectStub {
  const id = env.FREQUENCY_STORE.idFromName(OBJECT_NAME);
  return env.FREQUENCY_STORE.get(id);
}

async function jsonFromStub<T>(stub: DurableObjectStub, path: string): Promise<T> {
  const response = await stub.fetch(`https://frequency-store.internal${path}`);
  if (!response.ok) throw new Error(`FrequencyStore internal request failed: ${response.status}`);
  return response.json<T>();
}

function createStoreApi(stub: DurableObjectStub): FrequencyStoreApi {
  return {
    getHealth: () => jsonFromStub(stub, "/internal/health"),
    getStatus: () => jsonFromStub(stub, "/internal/status"),
    getMinuteSeries: (fromMs, toMs) => {
      const query = new URLSearchParams();
      if (fromMs !== undefined) query.set("from", String(fromMs));
      if (toMs !== undefined) query.set("to", String(toMs));
      return jsonFromStub(stub, `/internal/minute-series?${query}`);
    },
    getRawSeries: (fromMs, toMs) => jsonFromStub(stub, `/internal/raw-series?from=${fromMs}&to=${toMs}`),
    getDelta: (afterMs) => jsonFromStub(stub, `/internal/delta?after=${afterMs}`)
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const stub = objectStub(env);
    return handleApiRequest(request, createStoreApi(stub), env, ctx);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const stub = objectStub(env);
    ctx.waitUntil(stub.fetch("https://frequency-store.internal/internal/ensure-alarm"));
  }
};
