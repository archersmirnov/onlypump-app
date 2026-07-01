export const WORKOUT_CACHE_KEY_PREFIX = "onlypump_workouts_cache_";
export const WORKOUT_CACHE_LOCAL_ID = "local";

export function normalizeWorkoutCacheIdentityValue(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function getWorkoutCacheProfileValues(profile = {}) {
  const values = [
    profile?.telegram_id,
    profile?.telegramId,
    profile?.id,
    profile?.email ? `email_${String(profile.email).trim().toLowerCase()}` : "",
    WORKOUT_CACHE_LOCAL_ID
  ].map(normalizeWorkoutCacheIdentityValue).filter(Boolean);

  return Array.from(new Set(values));
}

export function getWorkoutCacheKeys(profile = {}) {
  return getWorkoutCacheProfileValues(profile).map((value) => `${WORKOUT_CACHE_KEY_PREFIX}${value}`);
}

export function getPrimaryWorkoutCacheKey(profile = {}) {
  return getWorkoutCacheKeys(profile)[0] || `${WORKOUT_CACHE_KEY_PREFIX}${WORKOUT_CACHE_LOCAL_ID}`;
}

export function resolveWorkoutCacheStorage(storage = globalThis?.localStorage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    return null;
  }
  return storage;
}

export function parseWorkoutCachePayload(raw) {
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export function readWorkoutCacheEntry(profile = {}, options = {}) {
  const storage = resolveWorkoutCacheStorage(options.storage);
  if (!storage) return { key: null, workouts: [] };

  try {
    for (const key of getWorkoutCacheKeys(profile)) {
      const workouts = parseWorkoutCachePayload(storage.getItem(key));
      if (workouts.length) return { key, workouts };
    }
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
  }

  return { key: null, workouts: [] };
}

export function readCachedWorkoutsForProfile(profile = {}, options = {}) {
  return readWorkoutCacheEntry(profile, options).workouts;
}

export function writeCachedWorkoutsForProfile(profile = {}, workouts = [], options = {}) {
  const storage = resolveWorkoutCacheStorage(options.storage);
  if (!storage || !Array.isArray(workouts)) return [];
  if (!workouts.length && options.skipEmpty) return [];

  const keys = getWorkoutCacheKeys(profile);
  try {
    const payload = JSON.stringify(workouts);
    keys.forEach((key) => storage.setItem(key, payload));
    return keys;
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return [];
  }
}

export function removeCachedWorkoutsForProfile(profile = {}, options = {}) {
  const storage = resolveWorkoutCacheStorage(options.storage);
  if (!storage || typeof storage.removeItem !== "function") return [];

  const keys = getWorkoutCacheKeys(profile);
  try {
    keys.forEach((key) => storage.removeItem(key));
    return keys;
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return [];
  }
}
