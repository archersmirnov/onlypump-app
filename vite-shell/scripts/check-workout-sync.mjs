import assert from "node:assert/strict";
import {
  createWorkoutPendingQueue,
  getWorkoutFailedState,
  getWorkoutPatchItemId,
  getWorkoutQueuedState,
  getWorkoutSavedState,
  getWorkoutSendingState,
  mergeWorkoutPatch,
  mergeWorkoutPatchById,
  mergeWorkoutPatchCreatesByClientId,
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

console.log("workout sync checks passed");
