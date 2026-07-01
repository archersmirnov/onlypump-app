import { createEdgeFunctionClient, getOnlyPumpApiAuthToken } from "./edgeFunctionClient.js";
import {
  EDGE_FUNCTION_ENDPOINTS,
  EDGE_FUNCTION_NAMES,
  SUPABASE_PUBLISHABLE_KEY
} from "./endpoints.js";

function createLegacyEventEmitter(eventPrefix, emitDomainEvent = null) {
  if (typeof emitDomainEvent !== "function") return null;

  return (eventName, details = {}) => {
    const phase = String(eventName || "").split(".").pop() || "unknown";
    const isProfileAccessDenied =
      eventPrefix === "profile.api" &&
      phase === "success" &&
      details.action === "load_profile" &&
      Boolean(details.result?.access_denied && details.result?.profile);

    emitDomainEvent(isProfileAccessDenied ? "profile.api.access_denied" : `${eventPrefix}.${phase}`, details);
  };
}

function createLegacyCall({
  endpoint,
  endpointName,
  eventPrefix,
  keepalive = false,
  acceptResult = null,
  options = {}
}) {
  return async function callOnlyPumpApi(initData, action, payload = {}) {
    const client = createEdgeFunctionClient({
      endpoint,
      endpointName,
      publishableKey: options.publishableKey || SUPABASE_PUBLISHABLE_KEY,
      getAuthToken: options.getAuthToken || (() => getOnlyPumpApiAuthToken(options)),
      getInitData: () => initData,
      fetchImpl: options.fetchImpl || globalThis.fetch?.bind(globalThis),
      emitEvent: createLegacyEventEmitter(eventPrefix, options.emitDomainEvent),
      keepalive,
      acceptResult
    });

    return client(action, payload);
  };
}

export function callOnlyPumpProfileApi(initData, action, payload = {}, options = {}) {
  return createLegacyCall({
    endpoint: EDGE_FUNCTION_ENDPOINTS.profile,
    endpointName: EDGE_FUNCTION_NAMES.profile,
    eventPrefix: "profile.api",
    acceptResult: ({ action: currentAction, result }) =>
      currentAction === "load_profile" && Boolean(result?.access_denied && result?.profile),
    options
  })(initData, action, payload);
}

export function callOnlyPumpWorkoutsApi(initData, action, payload = {}, options = {}) {
  return createLegacyCall({
    endpoint: EDGE_FUNCTION_ENDPOINTS.workouts,
    endpointName: EDGE_FUNCTION_NAMES.workouts,
    eventPrefix: "workouts.api",
    options
  })(initData, action, payload);
}

export function callOnlyPumpNutritionApi(initData, action, payload = {}, options = {}) {
  return createLegacyCall({
    endpoint: EDGE_FUNCTION_ENDPOINTS.nutrition,
    endpointName: EDGE_FUNCTION_NAMES.nutrition,
    eventPrefix: "nutrition.api",
    options
  })(initData, action, payload);
}

export function createOnlyPumpLegacyApiAdapters(options = {}) {
  return {
    callOnlyPumpProfileApi: (initData, action, payload = {}) =>
      callOnlyPumpProfileApi(initData, action, payload, options),
    callOnlyPumpWorkoutsApi: (initData, action, payload = {}) =>
      callOnlyPumpWorkoutsApi(initData, action, payload, options),
    callOnlyPumpNutritionApi: (initData, action, payload = {}) =>
      callOnlyPumpNutritionApi(initData, action, payload, options)
  };
}
