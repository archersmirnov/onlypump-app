export function getWorkoutIdentityKeys(workoutOrId) {
  const raw = typeof workoutOrId === "object" ? (workoutOrId || {}) : { id: workoutOrId };
  const keys = [];
  const addKey = (prefix, value) => {
    if (value === undefined || value === null || value === "") return;
    keys.push(`${prefix}:${String(value)}`);
  };

  addKey("local", raw.id);
  addKey("supabase", raw.supabaseId);
  addKey("supabase", raw.supabase_id);
  addKey("supabase", raw.workout_id);
  addKey("supabase", raw.workoutId);
  if (typeof workoutOrId !== "object") addKey("supabase", workoutOrId);

  return Array.from(new Set(keys));
}

export function createWorkoutDeleteIdentitySet(items = []) {
  const identities = new Set();
  items.forEach((item) => {
    getWorkoutIdentityKeys(item).forEach((key) => identities.add(key));
  });
  return identities;
}

export function isWorkoutDeletePending(workout, deletedIdentitySet = new Set()) {
  return getWorkoutIdentityKeys(workout).some((key) => deletedIdentitySet.has(key));
}

export function filterPendingDeletedWorkouts(items = [], deletedIdentitySet = new Set()) {
  return (Array.isArray(items) ? items : []).filter((item) => !isWorkoutDeletePending(item, deletedIdentitySet));
}

export function hasProtectedWorkoutLocalState(workout = {}, pendingPatch = null) {
  return Boolean(
    workout?.pending ||
    workout?.isDirty ||
    workout?.isSaving ||
    workout?.isSyncing ||
    workout?.syncError ||
    workout?.pendingPatch ||
    pendingPatch ||
    workout?.pendingDeletedExerciseIds?.length ||
    workout?.pendingDeletedSetIds?.length
  );
}

export function mergeRemoteWorkoutsWithProtectedLocalState(loaded = [], current = [], options = {}) {
  const pendingPatches = options.pendingPatches || {};
  const localBySupabaseId = new Map();
  const protectedLocal = [];

  (Array.isArray(current) ? current : []).forEach((workout) => {
    if (workout?.supabaseId) localBySupabaseId.set(String(workout.supabaseId), workout);
    if (hasProtectedWorkoutLocalState(workout, pendingPatches[workout?.id])) protectedLocal.push(workout);
  });

  const loadedIds = new Set((Array.isArray(loaded) ? loaded : [])
    .map((workout) => String(workout?.supabaseId || ""))
    .filter(Boolean));
  const protectedWithoutRemote = protectedLocal.filter((workout) => (
    !workout.supabaseId || !loadedIds.has(String(workout.supabaseId))
  ));
  const merged = (Array.isArray(loaded) ? loaded : []).map((serverWorkout) => {
    const local = localBySupabaseId.get(String(serverWorkout?.supabaseId || ""));
    if (!hasProtectedWorkoutLocalState(local, pendingPatches[local?.id])) return serverWorkout;
    return {
      ...local,
      supabaseId: serverWorkout.supabaseId || local.supabaseId,
      pendingPatch: pendingPatches[local.id] || local.pendingPatch || null
    };
  });

  return [...protectedWithoutRemote, ...merged];
}

export function shouldUseWorkoutCacheImmediately({
  cached = [],
  canLoadRemote = false,
  useCache = true
} = {}) {
  return Boolean(Array.isArray(cached) && cached.length && useCache !== false && !canLoadRemote);
}

export function shouldPreserveCachedWorkoutsOnEmptyRemote({
  loaded = [],
  cached = []
} = {}) {
  return Boolean(
    Array.isArray(loaded) &&
    Array.isArray(cached) &&
    loaded.length === 0 &&
    cached.length > 0
  );
}

export function shouldPreserveCurrentWorkoutsOnEmptyRemote({
  mergedRemote = [],
  current = []
} = {}) {
  return Boolean(
    Array.isArray(mergedRemote) &&
    Array.isArray(current) &&
    mergedRemote.length === 0 &&
    current.length > 0
  );
}
