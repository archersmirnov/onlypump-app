import assert from "node:assert/strict";
import {
  EDGE_FUNCTION_ENDPOINTS,
  callOnlyPumpProfileApi,
  createOnlyPumpLegacyApiAdapters,
  formatOnlyPumpApiError
} from "../src/shared/api/index.js";

const createJsonResponse = ({ ok = true, status = 200, body = {} } = {}) => ({
  ok,
  status,
  json: async () => body
});

function createFetchRecorder(responseFactory) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return responseFactory(url, options);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

assert.deepEqual(Object.keys(EDGE_FUNCTION_ENDPOINTS).sort(), ["nutrition", "profile", "workouts"]);
assert.match(EDGE_FUNCTION_ENDPOINTS.profile, /onlypump-profile-api$/);
assert.match(EDGE_FUNCTION_ENDPOINTS.workouts, /onlypump-workouts-api$/);
assert.match(EDGE_FUNCTION_ENDPOINTS.nutrition, /onlypump-nutrition-api$/);

assert.equal(formatOnlyPumpApiError({ message: "Readable error" }), "Readable error");
assert.equal(formatOnlyPumpApiError({ details: "Details error" }), "Details error");
assert.equal(formatOnlyPumpApiError({ nested: { code: "x" } }), "{\"nested\":{\"code\":\"x\"}}");

const events = [];
const fetchImpl = createFetchRecorder(() =>
  createJsonResponse({ body: { ok: true, workouts: [{ id: "w1" }] } })
);
const adapters = createOnlyPumpLegacyApiAdapters({
  fetchImpl,
  getAuthToken: () => "test-token",
  emitDomainEvent: (type, details) => events.push({ type, details })
});

const workoutsResult = await adapters.callOnlyPumpWorkoutsApi("init-data", "load", {
  profile_id: "profile-1"
});

assert.equal(workoutsResult.ok, true);
assert.equal(fetchImpl.calls.length, 1);
assert.match(fetchImpl.calls[0].url, /onlypump-workouts-api$/);
assert.equal(fetchImpl.calls[0].options.method, "POST");
assert.equal(fetchImpl.calls[0].options.headers.Authorization, "Bearer test-token");
assert.equal(fetchImpl.calls[0].options.headers["Content-Type"], "application/json");
assert.equal(fetchImpl.calls[0].options.keepalive, false);

const requestBody = JSON.parse(fetchImpl.calls[0].options.body);
assert.deepEqual(requestBody, {
  initData: "init-data",
  action: "load",
  payload: { profile_id: "profile-1" }
});
assert.equal(events[0].type, "workouts.api.request");
assert.equal(events.at(-1).type, "workouts.api.success");

const profileEvents = [];
const profileFetch = createFetchRecorder(() =>
  createJsonResponse({
    ok: false,
    status: 403,
    body: { access_denied: true, profile: { id: "profile-1" } }
  })
);
const profileResult = await callOnlyPumpProfileApi("init-data", "load_profile", {}, {
  fetchImpl: profileFetch,
  getAuthToken: () => "profile-token",
  emitDomainEvent: (type, details) => profileEvents.push({ type, details })
});

assert.equal(profileResult.access_denied, true);
assert.equal(profileResult.profile.id, "profile-1");
assert.equal(profileEvents.at(-1).type, "profile.api.access_denied");

const failedFetch = createFetchRecorder(() =>
  createJsonResponse({
    ok: false,
    status: 500,
    body: { error: { message: "Backend failed", details: "trace-id" } }
  })
);
const failingAdapters = createOnlyPumpLegacyApiAdapters({
  fetchImpl: failedFetch,
  getAuthToken: () => "token"
});

await assert.rejects(
  () => failingAdapters.callOnlyPumpNutritionApi("init-data", "save", { id: "n1" }),
  (error) => {
    assert.equal(error.message, "Backend failed");
    assert.equal(error.status, 500);
    assert.equal(error.action, "save");
    assert.equal(error.endpointName, "onlypump-nutrition-api");
    return true;
  }
);

console.log("shared api checks passed");
