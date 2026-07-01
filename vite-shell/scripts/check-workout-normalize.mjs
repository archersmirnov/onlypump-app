import assert from "node:assert/strict";
import {
  getCompletedSetsFromWorkout,
  getExerciseCompletion,
  getFirstActiveSetId,
  getSetStatus,
  getWorkoutTypeMeta,
  isCompletedSet,
  isWorkingSet,
  normalizeSupersetGroupId,
  normalizeWorkoutStatus,
  normalizeWorkoutSupersetMetadata,
  normalizeWorkoutType
} from "../src/features/workouts/domain/index.js";

assert.equal(normalizeWorkoutStatus("planned"), "planned");
assert.equal(normalizeWorkoutStatus("scheduled"), "planned");
assert.equal(normalizeWorkoutStatus("plan"), "planned");
assert.equal(normalizeWorkoutStatus("active"), "active");
assert.equal(normalizeWorkoutStatus("started"), "active");
assert.equal(normalizeWorkoutStatus("in_progress"), "active");
assert.equal(normalizeWorkoutStatus("in-progress"), "active");
assert.equal(normalizeWorkoutStatus("completed"), "completed");
assert.equal(normalizeWorkoutStatus("unknown"), "completed");
assert.equal(normalizeWorkoutStatus(null), "completed");

assert.equal(normalizeWorkoutType("strength"), "strength");
assert.equal(normalizeWorkoutType("cardio"), "cardio");
assert.equal(normalizeWorkoutType("yoga"), "yoga");
assert.equal(normalizeWorkoutType("pilates"), "pilates");
assert.equal(normalizeWorkoutType("stretching"), "stretching");
assert.equal(normalizeWorkoutType("bad-type"), "strength");
assert.equal(getWorkoutTypeMeta("cardio").shortLabel, "Кардио");
assert.equal(getWorkoutTypeMeta("bad-type").id, "strength");

assert.equal(getSetStatus({ status: "completed" }), "completed");
assert.equal(getSetStatus({ isCompleted: true }), "completed");
assert.equal(getSetStatus({}), "pending");
assert.equal(getSetStatus(null), "pending");
assert.equal(isWorkingSet({ type: "warmup" }), false);
assert.equal(isWorkingSet({ type: "working" }), true);
assert.equal(isWorkingSet({}), true);
assert.equal(isCompletedSet({ status: "completed" }), true);
assert.equal(isCompletedSet({ status: "skipped" }), false);

const exercise = {
  id: "exercise-1",
  sets: [
    { id: "warmup-1", type: "warmup", status: "completed" },
    { id: "set-1", type: "working", status: "completed" },
    { id: "set-2", type: "working", status: "pending" },
    { id: "set-3", type: "working", isCompleted: true }
  ]
};

assert.deepEqual(getExerciseCompletion(exercise), {
  total: 3,
  completed: 2,
  done: false,
  partial: true
});
assert.equal(getFirstActiveSetId(exercise), "set-2");

const workout = { exercises: [exercise] };
const completedSets = getCompletedSetsFromWorkout(workout);
assert.equal(completedSets.length, 3);
assert.equal(completedSets[0].__exercise.id, "exercise-1");

const supersetGroupId = "11111111-1111-4111-8111-111111111111";
assert.equal(normalizeSupersetGroupId(supersetGroupId), supersetGroupId);
assert.equal(normalizeSupersetGroupId("not-a-uuid"), null);

const supersetWorkout = normalizeWorkoutSupersetMetadata({
  id: "workout-1",
  exercises: [
    { id: "solo", supersetGroupId },
    { id: "invalid", supersetGroupId: "not-a-uuid", isSuperset: true },
    { id: "a", superset_group_id: supersetGroupId },
    { id: "b", supersetId: supersetGroupId }
  ]
});

assert.equal(supersetWorkout.exercises[0].isSuperset, true);
assert.equal(supersetWorkout.exercises[0].supersetOrder, 1);
assert.equal(supersetWorkout.exercises[1].isSuperset, false);
assert.equal(supersetWorkout.exercises[1].supersetGroupId, null);
assert.equal(supersetWorkout.exercises[2].isSuperset, true);
assert.equal(supersetWorkout.exercises[2].supersetOrder, 2);
assert.equal(supersetWorkout.exercises[3].isSuperset, true);
assert.equal(supersetWorkout.exercises[3].supersetOrder, 3);
assert.equal(supersetWorkout.exercises[3].supersetId, supersetGroupId);

const singleSupersetWorkout = normalizeWorkoutSupersetMetadata({
  exercises: [{ id: "single", supersetGroupId: "22222222-2222-4222-8222-222222222222" }]
});
assert.deepEqual(singleSupersetWorkout.exercises[0], {
  id: "single",
  supersetGroupId: null,
  supersetId: null,
  supersetOrder: null,
  isSuperset: false
});

console.log("workout normalize checks passed");
