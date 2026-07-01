import assert from "node:assert/strict";
import {
  createWorkoutDeleteIdentitySet,
  createWorkoutSyncController,
  createWorkoutPendingQueue,
  filterPendingDeletedWorkouts,
  getWorkoutFailedState,
  getWorkoutIdentityKeys,
  getWorkoutPatchItemId,
  getWorkoutQueuedState,
  getWorkoutSavedState,
  getWorkoutSendingState,
  hasProtectedWorkoutLocalState,
  isWorkoutDeletePending,
  mergeRemoteWorkoutsWithProtectedLocalState,
  mergeWorkoutPatch,
  mergeWorkoutPatchById,
  mergeWorkoutPatchCreatesByClientId,
  requireWorkoutSyncRepository,
  shouldPreserveCachedWorkoutsOnEmptyRemote,
  shouldPreserveCurrentWorkoutsOnEmptyRemote,
  shouldUseWorkoutCacheImmediately,
  uniqueWorkoutSyncIds,
  workoutPatchHasChanges,
  WORKOUT_PATCH_COLLECTION_KEYS
} from "../src/features/workouts/sync/index.js";

assert.equal(WORKOUT_PATCH_COLLECTION_KEYS.includes("set_updates"), true);
assert.deepEqual(uniqueWorkoutSyncIds(["a", "a", "", null, "b"]), ["a", "b"]);
assert.equal(getWorkoutPatchItemId({ workout_set_id: "set-1" }, ["id", "workout_set_id"]), "set-1");
assert.equal(getWorkoutPatchItemId({}, ["id"]), "");

assert.deepEqual(mergeWorkoutPatchById([
  { id: "set-1", reps: 8 },
  { id: "set-1", weight_kg: 40 }
]), [{ id: "set-1", reps: 8, weight_kg: 40 }]);

assert.deepEqual(mergeWorkoutPatchCreatesByClientId([
  { client_id: "local-set-1", reps: 8 },
  { client_id: "local-set-1", weight_kg: 40 }
]), [{ client_id: "local-set-1", reps: 8, weight_kg: 40 }]);

const mergedPatch = mergeWorkoutPatch(
  {
    workout_updates: [{ id: "workout-1", title: "Old" }],
    exercise_updates: [{ id: "exercise-1", notes: "old" }],
    set_updates: [
      { id: "set-1", reps: 8 },
      { id: "set-2", reps: 10 }
    ]
  },
  {
    workout_updates: [{ id: "workout-1", title: "New" }],
    exercise_updates: [{ id: "exercise-1", notes: "new" }],
    set_updates: [{ id: "set-1", weight_kg: 42 }],
    deleted_set_ids: ["set-2"]
  }
);

assert.deepEqual(mergedPatch.workout_updates, [{ id: "workout-1", title: "New" }]);
assert.deepEqual(mergedPatch.exercise_updates, [{ id: "exercise-1", notes: "new" }]);
assert.deepEqual(mergedPatch.set_updates, [{ id: "set-1", reps: 8, weight_kg: 42 }]);
assert.deepEqual(mergedPatch.deleted_set_ids, ["set-2"]);

const deletedExercisePatch = mergeWorkoutPatch(
  {
    exercise_updates: [{ id: "exercise-1", notes: "keep?" }],
    set_updates: [{ id: "set-1", workout_exercise_id: "exercise-1", reps: 8 }],
    set_creates: [{ client_id: "local-set-1", workout_exercise_id: "exercise-1" }],
    deleted_set_refs: [{ client_id: "local-set-1", workout_exercise_id: "exercise-1" }]
  },
  {
    deleted_exercise_ids: ["exercise-1"]
  }
);

assert.deepEqual(deletedExercisePatch.exercise_updates, []);
assert.deepEqual(deletedExercisePatch.set_updates, []);
assert.deepEqual(deletedExercisePatch.set_creates, []);
assert.deepEqual(deletedExercisePatch.deleted_set_refs, []);
assert.deepEqual(deletedExercisePatch.deleted_exercise_ids, ["exercise-1"]);

assert.equal(workoutPatchHasChanges({}), false);
assert.equal(workoutPatchHasChanges({ set_updates: [] }), false);
assert.equal(workoutPatchHasChanges({ set_updates: [{ id: "set-1" }] }), true);

const queuedState = getWorkoutQueuedState({ id: "workout-local-1" }, { set_updates: [{ id: "set-1" }] });
assert.equal(queuedState.isDirty, true);
assert.equal(queuedState.isSaving, false);
assert.equal(queuedState.syncError, false);
assert.equal(queuedState.pendingPatch.set_updates.length, 1);

const sendingState = getWorkoutSendingState(queuedState);
assert.equal(sendingState.isSaving, true);
assert.equal(sendingState.isSyncing, true);
assert.equal(sendingState.syncError, false);

const savedState = getWorkoutSavedState(sendingState, { now: "2026-07-01T00:00:00.000Z" });
assert.equal(savedState.isDirty, false);
assert.equal(savedState.pendingPatch, null);
assert.equal(savedState.lastSavedAt, "2026-07-01T00:00:00.000Z");

const failedState = getWorkoutFailedState(sendingState, { set_updates: [{ id: "set-1" }] });
assert.equal(failedState.isSaving, false);
assert.equal(failedState.isSyncing, false);
assert.equal(failedState.syncError, true);
assert.equal(failedState.pendingPatch.set_updates.length, 1);

const queue = createWorkoutPendingQueue();
assert.equal(queue.get("workout-1"), null);
assert.equal(queue.has("workout-1"), false);
queue.queue("workout-1", { set_updates: [{ id: "set-1", reps: 8 }] });
queue.queue("workout-1", { set_updates: [{ id: "set-1", weight_kg: 40 }] });
assert.equal(queue.has("workout-1"), true);
assert.deepEqual(queue.ids(), ["workout-1"]);
assert.deepEqual(queue.get("workout-1").set_updates, [{ id: "set-1", reps: 8, weight_kg: 40 }]);
queue.clear("workout-1");
assert.equal(queue.has("workout-1"), false);
queue.queue("workout-2", { workout_updates: [{ id: "workout-2" }] });
queue.clearAll();
assert.deepEqual(queue.ids(), []);

assert.throws(() => requireWorkoutSyncRepository(null), /requires repository\.saveWorkoutPatch/);

const stateByWorkoutId = new Map();
const stateEvents = [];
const makeApplyWorkoutState = () => (workoutId, patcher, meta) => {
  const next = patcher(stateByWorkoutId.get(workoutId) || { id: workoutId });
  stateByWorkoutId.set(workoutId, next);
  stateEvents.push({ workoutId, meta, state: next });
  return next;
};

const repositoryCalls = [];
const repository = {
  async saveWorkoutPatch(workout, options = {}) {
    repositoryCalls.push({ workout, options });
    return { result: { ok: true }, payload: options.prebuiltPatch };
  }
};

const sync = createWorkoutSyncController({
  repository,
  applyWorkoutState: makeApplyWorkoutState(),
  now: () => "2026-07-01T01:00:00.000Z"
});

const queuedPatch = sync.queuePatch("workout-3", { set_updates: [{ id: "set-3", reps: 12 }] });
assert.equal(queuedPatch.set_updates[0].reps, 12);
assert.equal(sync.hasPendingPatch("workout-3"), true);
assert.deepEqual(sync.pendingWorkoutIds(), ["workout-3"]);
assert.equal(stateByWorkoutId.get("workout-3").isDirty, true);
assert.equal(stateByWorkoutId.get("workout-3").isSaving, false);

const flushed = await sync.flushPatch("workout-3");
assert.equal(flushed.ok, true);
assert.equal(repositoryCalls[0].workout, null);
assert.equal(repositoryCalls[0].options.prebuiltPatch.set_updates[0].id, "set-3");
assert.equal(sync.hasPendingPatch("workout-3"), false);
assert.equal(stateByWorkoutId.get("workout-3").isDirty, false);
assert.equal(stateByWorkoutId.get("workout-3").lastSavedAt, "2026-07-01T01:00:00.000Z");

const skipped = await sync.flushPatch("missing-workout");
assert.equal(skipped.ok, true);
assert.equal(skipped.skipped, true);

const failingSync = createWorkoutSyncController({
  repository: {
    async saveWorkoutPatch() {
      throw new Error("network down");
    }
  },
  applyWorkoutState: makeApplyWorkoutState()
});
failingSync.queuePatch("workout-4", { workout_updates: [{ id: "workout-4", title: "Failed" }] });
const failedFlush = await failingSync.flushPatch("workout-4");
assert.equal(failedFlush.ok, false);
assert.equal(failingSync.hasPendingPatch("workout-4"), true);
assert.equal(stateByWorkoutId.get("workout-4").syncError, true);
assert.equal(stateByWorkoutId.get("workout-4").pendingPatch.workout_updates[0].title, "Failed");

let resolveSlowSave;
const slowSave = new Promise((resolve) => {
  resolveSlowSave = resolve;
});
const slowSync = createWorkoutSyncController({
  repository: {
    async saveWorkoutPatch() {
      await slowSave;
      return { result: { ok: true } };
    }
  },
  applyWorkoutState: makeApplyWorkoutState()
});
slowSync.queuePatch("workout-5", { set_updates: [{ id: "set-5", reps: 8 }] });
const flushPromise = slowSync.flushPatch("workout-5");
slowSync.queuePatch("workout-5", { set_updates: [{ id: "set-5", weight_kg: 50 }] });
resolveSlowSave();
const slowResult = await flushPromise;
assert.equal(slowResult.ok, true);
assert.equal(slowResult.hasNewerPatch, true);
assert.equal(slowSync.hasPendingPatch("workout-5"), true);
assert.deepEqual(slowSync.getPendingPatch("workout-5").set_updates, [{ id: "set-5", reps: 8, weight_kg: 50 }]);

slowSync.clearPendingPatch("workout-5");
assert.equal(slowSync.hasPendingPatch("workout-5"), false);

const flushAllSync = createWorkoutSyncController({
  repository,
  applyWorkoutState: makeApplyWorkoutState()
});
flushAllSync.queuePatch("workout-6", { workout_updates: [{ id: "workout-6" }] });
flushAllSync.queuePatch("workout-7", { workout_updates: [{ id: "workout-7" }] });
const flushAllResults = await flushAllSync.flushAll();
assert.equal(flushAllResults.length, 2);
assert.deepEqual(flushAllResults.map((item) => item.ok), [true, true]);

assert.deepEqual(
  getWorkoutIdentityKeys({ id: "local-1", supabaseId: "server-1" }),
  ["local:local-1", "supabase:server-1"]
);

const deletedIdentities = createWorkoutDeleteIdentitySet([{ id: "local-1", supabaseId: "server-1" }]);
assert.equal(isWorkoutDeletePending({ supabaseId: "server-1" }, deletedIdentities), true);
assert.deepEqual(
  filterPendingDeletedWorkouts([{ id: "keep" }, { supabaseId: "server-1" }], deletedIdentities),
  [{ id: "keep" }]
);

assert.equal(hasProtectedWorkoutLocalState({ isDirty: true }), true);
assert.equal(hasProtectedWorkoutLocalState({ id: "plain" }), false);
assert.equal(hasProtectedWorkoutLocalState({ id: "plain" }, { workout_updates: [{ id: "server-2" }] }), true);

const mergedRemote = mergeRemoteWorkoutsWithProtectedLocalState(
  [{ id: "remote-local", supabaseId: "server-2", title: "Remote" }],
  [
    { id: "local-dirty", supabaseId: "server-2", title: "Local dirty", isDirty: true },
    { id: "local-pending-create", title: "Pending create", pending: true },
    { id: "local-clean", supabaseId: "server-3", title: "Clean local" }
  ],
  { pendingPatches: { "local-dirty": { workout_updates: [{ id: "server-2" }] } } }
);
assert.equal(mergedRemote.length, 2);
assert.equal(mergedRemote[0].id, "local-pending-create");
assert.equal(mergedRemote[1].title, "Local dirty");
assert.deepEqual(mergedRemote[1].pendingPatch, { workout_updates: [{ id: "server-2" }] });

assert.equal(shouldUseWorkoutCacheImmediately({ cached: [{ id: "cached" }], canLoadRemote: false }), true);
assert.equal(shouldUseWorkoutCacheImmediately({ cached: [{ id: "cached" }], canLoadRemote: true }), false);
assert.equal(
  shouldUseWorkoutCacheImmediately({ cached: [{ id: "cached" }], canLoadRemote: false, useCache: false }),
  false
);
assert.equal(shouldPreserveCachedWorkoutsOnEmptyRemote({ loaded: [], cached: [{ id: "cached" }] }), true);
assert.equal(
  shouldPreserveCachedWorkoutsOnEmptyRemote({ loaded: [{ id: "remote" }], cached: [{ id: "cached" }] }),
  false
);
assert.equal(shouldPreserveCurrentWorkoutsOnEmptyRemote({ mergedRemote: [], current: [{ id: "current" }] }), true);
assert.equal(
  shouldPreserveCurrentWorkoutsOnEmptyRemote({ mergedRemote: [{ id: "remote" }], current: [{ id: "current" }] }),
  false
);

console.log("workout sync checks passed");
