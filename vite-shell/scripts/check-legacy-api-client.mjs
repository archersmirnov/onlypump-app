import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const bridgeSource = await readFile(new URL("../../onlypump-legacy-api-client.js", import.meta.url), "utf8");

const context = {
  console,
  window: {}
};
vm.createContext(context);
vm.runInContext(bridgeSource, context);

assert.equal(typeof context.window.ONLYPUMP_LEGACY_API?.createOnlyPumpLegacyApiAdapters, "function");

const calls = [];
const events = [];
const fetchImpl = async (url, options) => {
  calls.push({ url, options });
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, nutrition: { calories: 2100 } })
  };
};

const adapters = context.window.ONLYPUMP_LEGACY_API.createOnlyPumpLegacyApiAdapters({
  endpoints: {
    nutrition: "https://example.test/functions/v1/onlypump-nutrition-api"
  },
  publishableKey: "anon-key",
  getAuthToken: () => "auth-token",
  fetchImpl,
  emitDomainEvent: (type, details) => events.push({ type, details })
});

const result = await adapters.callOnlyPumpNutritionApi("init-data", "load", { date: "2026-07-01" });

assert.equal(result.ok, true);
assert.equal(calls.length, 1);
assert.equal(calls[0].url, "https://example.test/functions/v1/onlypump-nutrition-api");
assert.equal(calls[0].options.method, "POST");
assert.equal(calls[0].options.headers.Authorization, "Bearer auth-token");
assert.equal(calls[0].options.headers.apikey, "anon-key");
assert.equal(calls[0].options.headers["Content-Type"], "application/json");

assert.deepEqual(JSON.parse(calls[0].options.body), {
  initData: "init-data",
  action: "load",
  payload: { date: "2026-07-01" }
});

assert.equal(events[0].type, "nutrition.api.request");
assert.equal(events.at(-1).type, "nutrition.api.success");

const profileEvents = [];
const profileFetchImpl = async () => ({
  ok: false,
  status: 403,
  json: async () => ({ access_denied: true, profile: { id: "profile-1" } })
});
const profileAdapters = context.window.ONLYPUMP_LEGACY_API.createOnlyPumpLegacyApiAdapters({
  endpoints: {
    profile: "https://example.test/functions/v1/onlypump-profile-api"
  },
  publishableKey: "anon-key",
  getAuthToken: () => "profile-token",
  fetchImpl: profileFetchImpl,
  emitDomainEvent: (type, details) => profileEvents.push({ type, details })
});

const profileResult = await profileAdapters.callOnlyPumpProfileApi("init-data", "load_profile", {});
assert.equal(profileResult.access_denied, true);
assert.equal(profileResult.profile.id, "profile-1");
assert.equal(profileEvents.at(-1).type, "profile.api.access_denied");

console.log("legacy api bridge checks passed");
