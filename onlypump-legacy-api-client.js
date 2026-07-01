(function (global) {
  "use strict";

  function formatOnlyPumpApiError(value, fallback) {
    if (!value) return fallback || "";
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.message || String(value);
    if (typeof value === "object") {
      var directMessage = value.message || value.error || value.error_description || value.hint || value.details;
      if (typeof directMessage === "string" && directMessage.trim()) return directMessage;
      try {
        return JSON.stringify(value);
      } catch (error) {
        return fallback || String(value);
      }
    }
    return String(value || fallback || "");
  }

  function createOnlyPumpApiError(config) {
    var safeConfig = config || {};
    var endpointName = safeConfig.endpointName || "onlypump-api";
    var action = safeConfig.action || "unknown";
    var status = safeConfig.status || 0;
    var result = safeConfig.result || null;
    var message = formatOnlyPumpApiError(result && (result.error || result.message || result));
    var error = new Error(message || endpointName + " " + action + " failed with " + status);
    error.endpointName = endpointName;
    error.action = action;
    error.status = status;
    error.payload = result;
    return error;
  }

  function createLegacyEventEmitter(eventPrefix, emitDomainEvent) {
    if (typeof emitDomainEvent !== "function") return null;
    return function emitLegacyApiEvent(eventName, details) {
      var safeDetails = details || {};
      var parts = String(eventName || "").split(".");
      var phase = parts[parts.length - 1] || "unknown";
      var isProfileAccessDenied =
        eventPrefix === "profile.api" &&
        phase === "success" &&
        safeDetails.action === "load_profile" &&
        Boolean(safeDetails.result && safeDetails.result.access_denied && safeDetails.result.profile);

      emitDomainEvent(isProfileAccessDenied ? "profile.api.access_denied" : eventPrefix + "." + phase, safeDetails);
    };
  }

  function createEdgeFunctionClient(config) {
    var safeConfig = config || {};
    var endpoint = safeConfig.endpoint;
    var endpointName = safeConfig.endpointName || "onlypump-api";
    var fetchImpl = safeConfig.fetchImpl || global.fetch;
    var emitEvent = safeConfig.emitEvent || null;
    var publishableKey = safeConfig.publishableKey || "";
    var getAuthToken = safeConfig.getAuthToken || function () { return publishableKey; };
    var getInitData = safeConfig.getInitData || function () { return ""; };
    var keepalive = Boolean(safeConfig.keepalive);
    var acceptResult = safeConfig.acceptResult || null;

    if (!endpoint) throw new Error(endpointName + " endpoint is required");
    if (typeof fetchImpl !== "function") throw new Error(endpointName + " fetch implementation is required");

    return async function callEdgeFunction(action, payload) {
      var safePayload = payload || {};
      emitEvent && emitEvent(endpointName + ".request", { action: action, payload: safePayload });

      var response = await fetchImpl(endpoint, {
        method: "POST",
        keepalive: keepalive,
        headers: {
          Authorization: "Bearer " + getAuthToken(),
          apikey: publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          initData: getInitData(),
          action: action,
          payload: safePayload
        })
      });

      var result = await response.json().catch(function () { return {}; });
      if (acceptResult && acceptResult({ action: action, payload: safePayload, response: response, result: result })) {
        emitEvent && emitEvent(endpointName + ".success", { action: action, status: response.status, result: result });
        return result;
      }

      if (!response.ok || result && (result.ok === false || result.error)) {
        var error = createOnlyPumpApiError({
          endpointName: endpointName,
          action: action,
          status: response.status,
          result: result
        });
        emitEvent && emitEvent(endpointName + ".failed", { action: action, status: response.status, error: error, result: result });
        throw error;
      }

      emitEvent && emitEvent(endpointName + ".success", { action: action, status: response.status, result: result });
      return result;
    };
  }

  function createLegacyCall(config) {
    var safeConfig = config || {};
    return async function callOnlyPumpApi(initData, action, payload) {
      var options = safeConfig.options || {};
      var client = createEdgeFunctionClient({
        endpoint: safeConfig.endpoint,
        endpointName: safeConfig.endpointName,
        publishableKey: options.publishableKey || "",
        getAuthToken: options.getAuthToken,
        getInitData: function () { return initData; },
        fetchImpl: options.fetchImpl || global.fetch,
        emitEvent: createLegacyEventEmitter(safeConfig.eventPrefix, options.emitDomainEvent),
        keepalive: safeConfig.keepalive,
        acceptResult: safeConfig.acceptResult
      });
      return client(action, payload || {});
    };
  }

  function createOnlyPumpLegacyApiAdapters(options) {
    var safeOptions = options || {};
    var endpoints = safeOptions.endpoints || {};
    return {
      callOnlyPumpProfileApi: function (initData, action, payload) {
        return createLegacyCall({
          endpoint: endpoints.profile,
          endpointName: "onlypump-profile-api",
          eventPrefix: "profile.api",
          acceptResult: function (data) {
            return data.action === "load_profile" && Boolean(data.result && data.result.access_denied && data.result.profile);
          },
          options: safeOptions
        })(initData, action, payload);
      },
      callOnlyPumpWorkoutsApi: function (initData, action, payload) {
        return createLegacyCall({
          endpoint: endpoints.workouts,
          endpointName: "onlypump-workouts-api",
          eventPrefix: "workouts.api",
          keepalive: Boolean(safeOptions.workoutsKeepalive),
          options: safeOptions
        })(initData, action, payload);
      },
      callOnlyPumpNutritionApi: function (initData, action, payload) {
        return createLegacyCall({
          endpoint: endpoints.nutrition,
          endpointName: "onlypump-nutrition-api",
          eventPrefix: "nutrition.api",
          options: safeOptions
        })(initData, action, payload);
      }
    };
  }

  global.ONLYPUMP_LEGACY_API = {
    createOnlyPumpLegacyApiAdapters: createOnlyPumpLegacyApiAdapters,
    formatOnlyPumpApiError: formatOnlyPumpApiError
  };
})(window);
