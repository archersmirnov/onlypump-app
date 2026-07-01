import assert from "node:assert/strict";
import {
  getCompletedSetsFromWorkout,
  getExerciseCompletion,
  getFirstActiveSetId,
  getSetStatus,
  getWorkoutTypeMeta,
  isCompletedSet,
  isWorkingSet,
  normalizeWorkoutStatus,
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

console.log("workout normalize checks passed");
