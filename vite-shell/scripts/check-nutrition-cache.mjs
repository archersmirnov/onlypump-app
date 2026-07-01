import assert from "node:assert/strict";
import {
  clearCachedNutritionForProfileFromDate,
  getNutritionCacheKey,
  getNutritionCacheProfileId,
  getNutritionMarkersCacheKey,
  isNutritionDateKeyOnOrAfter,
  normalizeNutritionDateKey,
  normalizeNutritionFilledDateKeys,
  readCachedNutritionForProfile,
  readCachedNutritionMarkersForProfile,
  writeCachedNutritionForProfile,
  writeCachedNutritionMarkersForProfile
} from "../src/features/nutrition/index.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    dump() {
      return Object.fromEntries(store.entries());
    }
  };
}

assert.equal(getNutritionCacheProfileId({ telegram_id: "300449251", id: "profile-1" }), "300449251");
assert.equal(getNutritionCacheProfileId({ telegramId: "tg-1" }), "tg-1");
assert.equal(getNutritionCacheProfileId({ id: "profile-1" }), "profile-1");
assert.equal(getNutritionCacheProfileId({}), "local");
assert.equal(normalizeNutritionDateKey("2026-07-01T00:00:00Z"), "2026-07-01");
assert.equal(normalizeNutritionDateKey("bad", "2026-07-01"), "2026-07-01");
assert.deepEqual(normalizeNutritionFilledDateKeys([
  "2026-07-02",
  "bad",
  "2026-07-01T00:00:00Z",
  "2026-07-02"
]), ["2026-07-01", "2026-07-02"]);

assert.equal(
  getNutritionCacheKey({ telegram_id: "300449251" }, "2026-07-01"),
  "onlypump_nutrition_cache_300449251_2026-07-01"
);
assert.equal(
  getNutritionMarkersCacheKey({ id: "profile-1" }),
  "onlypump_nutrition_markers_profile-1"
);
assert.equal(isNutritionDateKeyOnOrAfter("2026-07-02", "2026-07-01"), true);
assert.equal(isNutritionDateKeyOnOrAfter("2026-06-30", "2026-07-01"), false);

const storage = createMemoryStorage();
const profile = { telegram_id: "300449251" };
const nutritionDay = {
  date: "2026-07-01",
  totals: {
    calories: 2200,
    protein: 180,
    fat: 70,
    carbs: 240,
    fiber: 30
  },
  meals: []
};

const writtenKey = writeCachedNutritionForProfile(profile, "2026-07-01", nutritionDay, { storage });
assert.equal(writtenKey, "onlypump_nutrition_cache_300449251_2026-07-01");
assert.deepEqual(readCachedNutritionForProfile(profile, "2026-07-01", { storage }), nutritionDay);
assert.equal(readCachedNutritionForProfile(profile, "2026-07-02", { storage }), null);

const markersKey = writeCachedNutritionMarkersForProfile(profile, [
  "2026-07-02",
  "2026-07-01",
  "bad",
  "2026-07-01"
], { storage });
assert.equal(markersKey, "onlypump_nutrition_markers_300449251");
assert.deepEqual(readCachedNutritionMarkersForProfile(profile, { storage }), ["2026-07-01", "2026-07-02"]);

writeCachedNutritionForProfile(profile, "2026-07-02", { date: "2026-07-02" }, { storage });
writeCachedNutritionForProfile(profile, "2026-07-03", { date: "2026-07-03" }, { storage });
writeCachedNutritionForProfile({ telegram_id: "other" }, "2026-07-03", { date: "2026-07-03" }, { storage });
const removed = clearCachedNutritionForProfileFromDate(profile, "2026-07-02", { storage });
assert.deepEqual(removed, [
  "onlypump_nutrition_cache_300449251_2026-07-02",
  "onlypump_nutrition_cache_300449251_2026-07-03"
]);
assert.deepEqual(readCachedNutritionForProfile(profile, "2026-07-01", { storage }), nutritionDay);
assert.deepEqual(readCachedNutritionForProfile({ telegram_id: "other" }, "2026-07-03", { storage }), { date: "2026-07-03" });

console.log("nutrition cache checks passed");
