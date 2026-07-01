export const NUTRITION_CACHE_KEY_PREFIX = "onlypump_nutrition_cache_";
export const NUTRITION_MARKERS_KEY_PREFIX = "onlypump_nutrition_markers_";
export const NUTRITION_CACHE_LOCAL_ID = "local";

export function resolveNutritionCacheStorage(storage = globalThis?.localStorage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    return null;
  }
  return storage;
}

export function getNutritionCacheProfileId(profile = {}) {
  return String(
    profile?.telegram_id ||
    profile?.telegramId ||
    profile?.id ||
    NUTRITION_CACHE_LOCAL_ID
  ).trim() || NUTRITION_CACHE_LOCAL_ID;
}

export function normalizeNutritionDateKey(value, fallback = "") {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : fallback;
}

export function getNutritionCacheKey(profile = {}, dateKey = "") {
  return `${NUTRITION_CACHE_KEY_PREFIX}${getNutritionCacheProfileId(profile)}_${normalizeNutritionDateKey(dateKey, dateKey)}`;
}

export function getNutritionMarkersCacheKey(profile = {}) {
  return `${NUTRITION_MARKERS_KEY_PREFIX}${getNutritionCacheProfileId(profile)}`;
}

export function normalizeNutritionFilledDateKeys(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((item) => normalizeNutritionDateKey(item))
      .filter(Boolean)
  )).sort();
}

export function parseNutritionCachePayload(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
}

export function readCachedNutritionForProfile(profile = {}, dateKey = "", options = {}) {
  const storage = resolveNutritionCacheStorage(options.storage);
  if (!storage) return null;

  try {
    return parseNutritionCachePayload(storage.getItem(getNutritionCacheKey(profile, dateKey)));
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return null;
  }
}

export function writeCachedNutritionForProfile(profile = {}, dateKey = "", nutritionDay = null, options = {}) {
  const storage = resolveNutritionCacheStorage(options.storage);
  const safeDateKey = normalizeNutritionDateKey(dateKey);
  if (!storage || !safeDateKey || !nutritionDay || typeof nutritionDay !== "object") return null;

  const key = getNutritionCacheKey(profile, safeDateKey);
  try {
    storage.setItem(key, JSON.stringify(nutritionDay));
    return key;
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return null;
  }
}

export function readCachedNutritionMarkersForProfile(profile = {}, options = {}) {
  const storage = resolveNutritionCacheStorage(options.storage);
  if (!storage) return [];

  try {
    const raw = storage.getItem(getNutritionMarkersCacheKey(profile));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeNutritionFilledDateKeys(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return [];
  }
}

export function writeCachedNutritionMarkersForProfile(profile = {}, dateKeys = [], options = {}) {
  const storage = resolveNutritionCacheStorage(options.storage);
  if (!storage) return null;

  const clean = normalizeNutritionFilledDateKeys(dateKeys);
  const key = getNutritionMarkersCacheKey(profile);
  try {
    storage.setItem(key, JSON.stringify(clean));
    return key;
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return null;
  }
}

export function isNutritionDateKeyOnOrAfter(dateKey, fromDateKey) {
  const safeDate = normalizeNutritionDateKey(dateKey);
  const safeFrom = normalizeNutritionDateKey(fromDateKey);
  return Boolean(safeDate && safeFrom && safeDate >= safeFrom);
}

export function clearCachedNutritionForProfileFromDate(profile = {}, fromDateKey = "", options = {}) {
  const storage = resolveNutritionCacheStorage(options.storage);
  if (!storage || typeof storage.removeItem !== "function" || typeof storage.key !== "function") return [];

  const safeFromDateKey = normalizeNutritionDateKey(fromDateKey);
  if (!safeFromDateKey) return [];

  const prefix = `${NUTRITION_CACHE_KEY_PREFIX}${getNutritionCacheProfileId(profile)}_`;
  const keysToRemove = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const dateKey = normalizeNutritionDateKey(key.slice(prefix.length, prefix.length + 10));
      if (isNutritionDateKeyOnOrAfter(dateKey, safeFromDateKey)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
    return keysToRemove;
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return [];
  }
}
