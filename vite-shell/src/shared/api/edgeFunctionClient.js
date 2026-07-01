import { createOnlyPumpApiError } from "./apiErrors.js";
import {
  EDGE_FUNCTION_ENDPOINTS,
  EDGE_FUNCTION_NAMES,
  SUPABASE_PUBLISHABLE_KEY
} from "./endpoints.js";

export function getOnlyPumpApiAuthToken({
  webAuthToken = globalThis.__ONLYPUMP_WEB_ACCESS_TOKEN__,
  publishableKey = SUPABASE_PUBLISHABLE_KEY
} = {}) {
  return webAuthToken || publishableKey || "";
}

export function createEdgeFunctionClient({
  endpoint,
  endpointName = "onlypump-api",
  publishableKey = SUPABASE_PUBLISHABLE_KEY,
  getAuthToken = () => getOnlyPumpApiAuthToken({ publishableKey }),
  getInitData = () => "",
  fetchImpl = globalThis.fetch?.bind(globalThis),
  emitEvent = null,
  keepalive = false,
  acceptResult = null
} = {}) {
  if (!endpoint) {
    throw new Error(`${endpointName} endpoint is required`);
  }
  if (typeof fetchImpl !== "function") {
    throw new Error(`${endpointName} fetch implementation is required`);
  }

  return async function callEdgeFunction(action, payload = {}) {
    emitEvent?.(`${endpointName}.request`, { action, payload });

    const response = await fetchImpl(endpoint, {
      method: "POST",
      keepalive,
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        apikey: publishableKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        initData: getInitData(),
        action,
        payload
      })
    });

    const result = await response.json().catch(() => ({}));
    if (acceptResult?.({ action, payload, response, result })) {
      emitEvent?.(`${endpointName}.success`, { action, status: response.status, result });
      return result;
    }

    if (!response.ok || result?.ok === false || result?.error) {
      const error = createOnlyPumpApiError({
        endpointName,
        action,
        status: response.status,
        result
      });
      emitEvent?.(`${endpointName}.failed`, { action, status: response.status, error, result });
      throw error;
    }

    emitEvent?.(`${endpointName}.success`, { action, status: response.status, result });
    return result;
  };
}

export function createOnlyPumpApiClients(options = {}) {
  return {
    profile: createEdgeFunctionClient({
      ...options,
      endpoint: EDGE_FUNCTION_ENDPOINTS.profile,
      endpointName: EDGE_FUNCTION_NAMES.profile,
      acceptResult: ({ action, result }) =>
        action === "load_profile" && Boolean(result?.access_denied && result?.profile)
    }),
    workouts: createEdgeFunctionClient({
      ...options,
      endpoint: EDGE_FUNCTION_ENDPOINTS.workouts,
      endpointName: EDGE_FUNCTION_NAMES.workouts,
      keepalive: options.keepalive ?? true
    }),
    nutrition: createEdgeFunctionClient({
      ...options,
      endpoint: EDGE_FUNCTION_ENDPOINTS.nutrition,
      endpointName: EDGE_FUNCTION_NAMES.nutrition
    })
  };
}
