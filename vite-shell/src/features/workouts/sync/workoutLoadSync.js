import {
  readWorkoutCacheEntry,
  writeCachedWorkoutsForProfile
} from "./workoutCache.js";
import {
  createWorkoutDeleteIdentitySet,
  filterPendingDeletedWorkouts,
  mergeRemoteWorkoutsWithProtectedLocalState,
  shouldPreserveCachedWorkoutsOnEmptyRemote,
  shouldPreserveCurrentWorkoutsOnEmptyRemote,
  shouldUseWorkoutCacheImmediately
} from "./workoutCachePolicy.js";
import {
  normalizeWorkoutSyncError,
  notifyWorkoutSyncEvent,
  summarizeWorkoutSyncPatch
} from "./workoutSync.js";

export function requireWorkoutLoadRepository(repository) {
  if (!repository || typeof repository.loadWorkouts !== "function") {
    throw new TypeError("loadWorkoutsWithSyncPolicy requires repository.loadWorkouts");
  }
  return repository;
}

export function getPendingWorkoutPatchSnapshot(source = null) {
  if (!source) return {};
  if (typeof source.ids === "function" && typeof source.get === "function") {
    return source.ids().reduce((snapshot, workoutId) => {
      snapshot[workoutId] = source.get(workoutId);
      return snapshot;
    }, {});
  }
  if (typeof source === "object") return { ...source };
  return {};
}

export function readWorkoutLoadResponseWorkouts(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.workouts)) return response.workouts;
  if (Array.isArray(response?.loadedWorkouts)) return response.loadedWorkouts;
  if (Array.isArray(response?.result?.workouts)) return response.result.workouts;
  return [];
}

export function resolveWorkoutLoadResponseProfile(response = {}, fallbackProfile = {}, normalizeProfile = null) {
  const rawProfile = response?.profile || response?.result?.profile || null;
  if (!rawProfile) return fallbackProfile || {};
  if (typeof normalizeProfile === "function") return normalizeProfile(rawProfile, fallbackProfile || {});
  return rawProfile;
}

export function getWorkoutLoadProfileKey(profile = {}) {
  return String(profile?.id || profile?.telegram_id || profile?.telegramId || profile?.email || "local");
}

export function uniqueWorkoutLoadProfiles(profiles = []) {
  const seen = new Set();
  return profiles.filter((profile) => {
    const key = getWorkoutLoadProfileKey(profile);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createWorkoutLoadEvent(phase, details = {}) {
  return {
    domain: "workouts.sync",
    phase,
    source: details.source || null,
    profileId: details.profile?.id || details.profileId || null,
    responseProfileId: details.responseProfile?.id || null,
    cacheKey: details.cacheKey || null,
    cacheCount: Array.isArray(details.cachedWorkouts) ? details.cachedWorkouts.length : undefined,
    remoteCount: Array.isArray(details.remoteWorkouts) ? details.remoteWorkouts.length : undefined,
    returnedCount: Array.isArray(details.workouts) ? details.workouts.length : undefined,
    pendingPatchSummary: Object.fromEntries(
      Object.entries(details.pendingPatches || {}).map(([workoutId, patch]) => [
        workoutId,
        summarizeWorkoutSyncPatch(patch)
      ])
    ),
    error: details.error ? normalizeWorkoutSyncError(details.error) : null
  };
}

export function emitWorkoutLoadEvent(onEvent, phase, details = {}) {
  return notifyWorkoutSyncEvent(onEvent, createWorkoutLoadEvent(phase, details));
}

export async function loadWorkoutsWithSyncPolicy({
  repository,
  profile = {},
  currentWorkouts = [],
  pendingQueue = null,
  pendingPatches = null,
  pendingDeletedWorkouts = [],
  pendingDeletedWorkoutIds = [],
  storage = undefined,
  canLoadRemote = true,
  useCache = true,
  preserveCacheOnEmptyRemote = false,
  preserveCurrentOnEmptyRemote = false,
  writeRemoteCache = true,
  loadInput = null,
  loadOptions = {},
  loadRescueWorkouts = null,
  normalizeProfile = null,
  onEvent = null,
  onCacheError = null
} = {}) {
  const workoutRepository = requireWorkoutLoadRepository(repository);
  const pendingPatchSnapshot = pendingPatches || getPendingWorkoutPatchSnapshot(pendingQueue);
  const pendingDeletedItems = [
    ...(Array.isArray(pendingDeletedWorkouts) ? pendingDeletedWorkouts : []),
    ...(Array.isArray(pendingDeletedWorkoutIds) ? pendingDeletedWorkoutIds.map((id) => ({ id, supabaseId: id })) : [])
  ];
  const deletedIdentitySet = createWorkoutDeleteIdentitySet(pendingDeletedItems);
  const cacheEntry = useCache === false
    ? { key: null, workouts: [] }
    : readWorkoutCacheEntry(profile, { storage, onError: onCacheError });
  const cachedWorkouts = filterPendingDeletedWorkouts(cacheEntry.workouts, deletedIdentitySet);

  const mergeLoadedWorkouts = (items = []) => filterPendingDeletedWorkouts(
    mergeRemoteWorkoutsWithProtectedLocalState(
      filterPendingDeletedWorkouts(items, deletedIdentitySet),
      currentWorkouts,
      { pendingPatches: pendingPatchSnapshot }
    ),
    deletedIdentitySet
  );

  if (shouldUseWorkoutCacheImmediately({ cached: cachedWorkouts, canLoadRemote, useCache })) {
    const workouts = mergeLoadedWorkouts(cachedWorkouts);
    emitWorkoutLoadEvent(onEvent, "load:cache", {
      source: "cache",
      profile,
      cacheKey: cacheEntry.key,
      cachedWorkouts,
      workouts,
      pendingPatches: pendingPatchSnapshot
    });
    return { ok: true, source: "cache", cacheKey: cacheEntry.key, workouts };
  }

  if (!canLoadRemote) {
    emitWorkoutLoadEvent(onEvent, "load:empty", {
      source: "empty",
      profile,
      cacheKey: cacheEntry.key,
      cachedWorkouts,
      workouts: [],
      pendingPatches: pendingPatchSnapshot
    });
    return { ok: true, source: "empty", cacheKey: cacheEntry.key, workouts: [] };
  }

  try {
    const response = await workoutRepository.loadWorkouts(
      loadInput || { profile_id: profile?.id },
      loadOptions
    );
    const responseProfile = resolveWorkoutLoadResponseProfile(response, profile, normalizeProfile);
    const remoteWorkouts = filterPendingDeletedWorkouts(readWorkoutLoadResponseWorkouts(response), deletedIdentitySet);
    let source = "remote";
    let workouts = mergeLoadedWorkouts(remoteWorkouts);

    if (!workouts.length && typeof loadRescueWorkouts === "function") {
      const rescuedWorkouts = filterPendingDeletedWorkouts(
        await loadRescueWorkouts(responseProfile || profile, response),
        deletedIdentitySet
      );
      if (rescuedWorkouts.length) {
        source = "rescue";
        workouts = mergeLoadedWorkouts(rescuedWorkouts);
      }
    }

    if (
      !workouts.length &&
      preserveCacheOnEmptyRemote &&
      shouldPreserveCachedWorkoutsOnEmptyRemote({ loaded: workouts, cached: cachedWorkouts })
    ) {
      source = "cache_empty_remote";
      workouts = mergeLoadedWorkouts(cachedWorkouts);
    }

    if (
      !workouts.length &&
      preserveCurrentOnEmptyRemote &&
      shouldPreserveCurrentWorkoutsOnEmptyRemote({ mergedRemote: workouts, current: currentWorkouts })
    ) {
      source = "current_empty_remote";
      workouts = filterPendingDeletedWorkouts(currentWorkouts, deletedIdentitySet);
    }

    const cacheProfiles = uniqueWorkoutLoadProfiles([profile, responseProfile]);
    if (writeRemoteCache) {
      cacheProfiles.forEach((cacheProfile) => {
        writeCachedWorkoutsForProfile(cacheProfile, workouts, {
          storage,
          skipEmpty: false,
          onError: onCacheError
        });
      });
    }

    emitWorkoutLoadEvent(onEvent, "load:remote", {
      source,
      profile,
      responseProfile,
      cacheKey: cacheEntry.key,
      cachedWorkouts,
      remoteWorkouts,
      workouts,
      pendingPatches: pendingPatchSnapshot
    });

    return {
      ok: true,
      source,
      cacheKey: cacheEntry.key,
      response,
      responseProfile,
      workouts
    };
  } catch (error) {
    if (cachedWorkouts.length) {
      const workouts = mergeLoadedWorkouts(cachedWorkouts);
      emitWorkoutLoadEvent(onEvent, "load:fallback", {
        source: "cache_fallback",
        profile,
        cacheKey: cacheEntry.key,
        cachedWorkouts,
        workouts,
        pendingPatches: pendingPatchSnapshot,
        error
      });
      return {
        ok: false,
        fallback: true,
        source: "cache_fallback",
        cacheKey: cacheEntry.key,
        error,
        workouts
      };
    }

    emitWorkoutLoadEvent(onEvent, "load:failed", {
      source: "error",
      profile,
      cacheKey: cacheEntry.key,
      cachedWorkouts,
      workouts: [],
      pendingPatches: pendingPatchSnapshot,
      error
    });
    return {
      ok: false,
      source: "error",
      cacheKey: cacheEntry.key,
      error,
      workouts: []
    };
  }
}
