export const WORKOUT_PATCH_COLLECTION_KEYS = Object.freeze([
  "workout_updates",
  "exercise_updates",
  "set_updates",
  "exercise_creates",
  "set_creates",
  "exercise_upserts",
  "set_upserts",
  "deleted_workout_ids",
  "deleted_exercise_ids",
  "deleted_set_ids",
  "deleted_set_refs"
]);

export function uniqueWorkoutSyncIds(ids = []) {
  return Array.from(new Set(ids.filter(Boolean).map(String)));
}

export function getWorkoutPatchItemId(item = {}, keys = ["id"]) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

export function mergeWorkoutPatchById(items = []) {
  const map = new Map();
  items.filter(Boolean).forEach((item) => {
    const id = item.id || item.workout_id || item.exercise_id || item.set_id;
    if (!id) return;
    map.set(String(id), { ...(map.get(String(id)) || {}), ...item, id });
  });
  return Array.from(map.values());
}

export function mergeWorkoutPatchCreatesByClientId(items = []) {
  const map = new Map();
  items.filter(Boolean).forEach((item, index) => {
    const key = item.client_id
      || item.clientId
      || item.local_id
      || item.localId
      || item.id
      || `${item.workout_id || item.workout_exercise_id || "create"}-${item.exercise_order || item.set_order || index}`;
    map.set(String(key), { ...(map.get(String(key)) || {}), ...item });
  });
  return Array.from(map.values());
}

export function mergeWorkoutPatch(base = {}, patch = {}) {
  const deletedExerciseIds = uniqueWorkoutSyncIds([
    ...(base.deleted_exercise_ids || []),
    ...(patch.deleted_exercise_ids || [])
  ]);
  const deletedSetIds = uniqueWorkoutSyncIds([
    ...(base.deleted_set_ids || []),
    ...(patch.deleted_set_ids || [])
  ]);
  const deletedExerciseIdSet = new Set(deletedExerciseIds);
  const deletedSetIdSet = new Set(deletedSetIds);
  const isForDeletedExercise = (item = {}) => deletedExerciseIdSet.has(getWorkoutPatchItemId(item, [
    "workout_exercise_id",
    "workoutExerciseId",
    "exercise_id",
    "exerciseId"
  ]));
  const isDeletedSetUpdate = (item = {}) => deletedSetIdSet.has(getWorkoutPatchItemId(item, [
    "id",
    "set_id",
    "setId",
    "workout_set_id",
    "workoutSetId"
  ]));

  return {
    workout_updates: mergeWorkoutPatchById([...(base.workout_updates || []), ...(patch.workout_updates || [])]),
    exercise_updates: mergeWorkoutPatchById([...(base.exercise_updates || []), ...(patch.exercise_updates || [])])
      .filter((item) => !deletedExerciseIdSet.has(getWorkoutPatchItemId(item, ["id", "exercise_id", "exerciseId", "workout_exercise_id", "workoutExerciseId"]))),
    set_updates: mergeWorkoutPatchById([...(base.set_updates || []), ...(patch.set_updates || [])])
      .filter((item) => !isDeletedSetUpdate(item) && !isForDeletedExercise(item)),
    exercise_creates: mergeWorkoutPatchCreatesByClientId([...(base.exercise_creates || []), ...(patch.exercise_creates || [])]),
    set_creates: mergeWorkoutPatchCreatesByClientId([...(base.set_creates || []), ...(patch.set_creates || [])])
      .filter((item) => !isForDeletedExercise(item)),
    exercise_upserts: mergeWorkoutPatchCreatesByClientId([...(base.exercise_upserts || []), ...(patch.exercise_upserts || [])]),
    set_upserts: mergeWorkoutPatchCreatesByClientId([...(base.set_upserts || []), ...(patch.set_upserts || [])])
      .filter((item) => !isForDeletedExercise(item)),
    deleted_workout_ids: uniqueWorkoutSyncIds([...(base.deleted_workout_ids || []), ...(patch.deleted_workout_ids || [])]),
    deleted_exercise_ids: deletedExerciseIds,
    deleted_set_ids: deletedSetIds,
    deleted_set_refs: mergeWorkoutPatchCreatesByClientId([...(base.deleted_set_refs || []), ...(patch.deleted_set_refs || [])])
      .filter((item) => !isForDeletedExercise(item))
  };
}

export function workoutPatchHasChanges(patch = {}) {
  return WORKOUT_PATCH_COLLECTION_KEYS.some((key) => Array.isArray(patch?.[key]) && patch[key].length > 0);
}

export function getWorkoutQueuedState(workout = {}, patch = null) {
  return {
    ...workout,
    isDirty: true,
    isSaving: false,
    syncError: false,
    pendingPatch: patch || workout.pendingPatch || null
  };
}

export function getWorkoutSendingState(workout = {}, patch = null) {
  return {
    ...workout,
    isDirty: true,
    isSaving: true,
    isSyncing: true,
    syncError: false,
    pendingPatch: patch || workout.pendingPatch || null
  };
}

export function getWorkoutSavedState(workout = {}, options = {}) {
  const lastSavedAt = options.lastSavedAt || options.now || new Date().toISOString();
  return {
    ...workout,
    isDirty: false,
    isSaving: false,
    isSyncing: false,
    syncError: false,
    pendingPatch: null,
    lastSavedAt
  };
}

export function getWorkoutFailedState(workout = {}, patch = null) {
  return {
    ...workout,
    isSaving: false,
    isSyncing: false,
    syncError: true,
    pendingPatch: patch || workout.pendingPatch || null
  };
}

export function createWorkoutPendingQueue(initialPatches = {}) {
  const patches = { ...initialPatches };

  return {
    ids() {
      return Object.keys(patches).filter((workoutId) => workoutPatchHasChanges(patches[workoutId]));
    },

    get(workoutId) {
      return patches[workoutId] || null;
    },

    queue(workoutId, patch) {
      if (!workoutId || !patch) return null;
      patches[workoutId] = mergeWorkoutPatch(patches[workoutId], patch);
      return patches[workoutId];
    },

    has(workoutId) {
      return workoutPatchHasChanges(patches[workoutId]);
    },

    clear(workoutId) {
      delete patches[workoutId];
    },

    clearAll() {
      Object.keys(patches).forEach((workoutId) => delete patches[workoutId]);
    },

    snapshot() {
      return { ...patches };
    }
  };
}
