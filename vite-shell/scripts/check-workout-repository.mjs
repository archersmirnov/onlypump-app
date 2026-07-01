import assert from "node:assert/strict";
import {
  buildWorkoutExerciseCreateApiPayload,
  buildWorkoutExerciseDeletePayload,
  buildWorkoutExerciseUpdateApiPayload,
  buildWorkoutDeletePayload,
  buildWorkoutLoadPayload,
  buildWorkoutSetCreateApiPayload,
  buildWorkoutSetDeletePayload,
  buildWorkoutSetUpdateApiPayload,
  createWorkoutRepository,
  isWorkoutDeleteResponseConfirmed,
  isWorkoutMutationResponseOk,
  requireWorkoutApiCaller,
  resolveWorkoutProfileId,
  WORKOUT_REPOSITORY_ACTIONS
} from "../src/features/workouts/api/index.js";

assert.equal(WORKOUT_REPOSITORY_ACTIONS.load, "load");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.createWorkoutTree, "create_workout_tree");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.createExercise, "create_exercise");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.updateExercise, "update_exercise");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.deleteExercise, "delete_exercise");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.createSet, "create_set");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.updateSet, "update_set");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.deleteSet, "delete_set");
assert.throws(() => requireWorkoutApiCaller(null), /requires callWorkoutsApi/);
assert.equal(resolveWorkoutProfileId({ profile_id: "profile-a" }, "fallback"), "profile-a");
assert.equal(resolveWorkoutProfileId({ profileId: "profile-b" }, "fallback"), "profile-b");
assert.equal(resolveWorkoutProfileId({}, "fallback"), "fallback");
assert.deepEqual(buildWorkoutLoadPayload({}, "profile-1"), { profile_id: "profile-1" });
assert.throws(() => buildWorkoutLoadPayload(), /profile_id is required/);
assert.deepEqual(buildWorkoutDeletePayload({ supabaseId: "workout-1" }, "profile-1"), {
  profile_id: "profile-1",
  id: "workout-1",
  workout_id: "workout-1"
});
assert.deepEqual(buildWorkoutDeletePayload("workout-2", "profile-1"), {
  profile_id: "profile-1",
  id: "workout-2",
  workout_id: "workout-2"
});
assert.throws(() => buildWorkoutDeletePayload("workout-1"), /profile_id is required/);
assert.throws(() => buildWorkoutDeletePayload({}, "profile-1"), /workout id is required/);

assert.equal(isWorkoutDeleteResponseConfirmed({ ok: true }, "workout-1"), true);
assert.equal(isWorkoutDeleteResponseConfirmed({ deleted_count: 1 }, "workout-1"), true);
assert.equal(isWorkoutDeleteResponseConfirmed({ deleted_count: 0 }, "workout-1"), false);
assert.equal(isWorkoutDeleteResponseConfirmed({ deleted_workout_ids: ["workout-1"] }, "workout-1"), true);
assert.equal(isWorkoutDeleteResponseConfirmed({ deleted_workout_ids: ["other"] }, "workout-1"), false);
assert.equal(isWorkoutDeleteResponseConfirmed({ deleted_workout_ids: [] }, "workout-1"), false);
assert.equal(isWorkoutDeleteResponseConfirmed({ error: "bad" }, "workout-1"), false);
assert.equal(isWorkoutMutationResponseOk({ ok: true }), true);
assert.equal(isWorkoutMutationResponseOk({ success: false }), false);
assert.equal(isWorkoutMutationResponseOk({ error: "bad" }), false);

const exercise = {
  id: "exercise-local-1",
  supabaseId: "exercise-server-1",
  name: "Row",
  order: 1,
  sets: []
};
const set = {
  id: "set-local-1",
  supabaseId: "set-server-1",
  order: 1,
  weight: 40,
  reps: 10
};

const exerciseCreatePayload = buildWorkoutExerciseCreateApiPayload("workout-server-1", exercise, { profileId: "profile-1" });
assert.equal(exerciseCreatePayload.profile_id, "profile-1");
assert.equal(exerciseCreatePayload.workout_id, "workout-server-1");
assert.equal(exerciseCreatePayload.exercise.workout_id, "workout-server-1");
assert.equal(exerciseCreatePayload.exercise_name, "Row");
assert.throws(() => buildWorkoutExerciseCreateApiPayload(null, exercise, { profileId: "profile-1" }), /workout_id is required/);

const exerciseUpdatePayload = buildWorkoutExerciseUpdateApiPayload("workout-server-1", exercise, { profileId: "profile-1" });
assert.equal(exerciseUpdatePayload.id, "exercise-server-1");
assert.equal(exerciseUpdatePayload.exercise_id, "exercise-server-1");
assert.equal(exerciseUpdatePayload.workout_exercise_id, "exercise-server-1");
assert.equal(exerciseUpdatePayload.exercise.exercise_name, "Row");
assert.deepEqual(buildWorkoutExerciseDeletePayload(exercise, "profile-1"), {
  profile_id: "profile-1",
  id: "exercise-server-1",
  exercise_id: "exercise-server-1",
  workout_exercise_id: "exercise-server-1"
});
assert.throws(() => buildWorkoutExerciseDeletePayload({}, "profile-1"), /exercise id is required/);

const setCreatePayload = buildWorkoutSetCreateApiPayload("exercise-server-1", set, { profileId: "profile-1" });
assert.equal(setCreatePayload.profile_id, "profile-1");
assert.equal(setCreatePayload.workout_exercise_id, "exercise-server-1");
assert.equal(setCreatePayload.set.workout_exercise_id, "exercise-server-1");
assert.equal(setCreatePayload.weight_kg, 40);
const setUpdatePayload = buildWorkoutSetUpdateApiPayload("exercise-server-1", set, { profileId: "profile-1" });
assert.equal(setUpdatePayload.id, "set-server-1");
assert.equal(setUpdatePayload.set_id, "set-server-1");
assert.equal(setUpdatePayload.workout_set_id, "set-server-1");
assert.deepEqual(buildWorkoutSetDeletePayload(set, "profile-1"), {
  profile_id: "profile-1",
  id: "set-server-1",
  set_id: "set-server-1",
  workout_set_id: "set-server-1"
});
assert.throws(() => buildWorkoutSetUpdateApiPayload("exercise-server-1", { id: "" }, { profileId: "profile-1" }), /set id is required/);

const calls = [];
const callWorkoutsApi = async (action, payload) => {
  calls.push({ action, payload });
  if (action === "load") {
    return {
      workouts: [{
        id: "workout-server-1",
        workout_date: "2026-06-30",
        title: "Loaded",
        workout_exercises: [{
          id: "exercise-server-1",
          exercise_name: "Row",
          workout_sets: [{ id: "set-server-1", set_order: 1, weight_kg: 40, reps: 10 }]
        }]
      }]
    };
  }
  if (action === "delete_workout") return { deleted_workout_ids: [payload.workout_id], deleted_count: 1 };
  return { ok: true, action, payload };
};

const repository = createWorkoutRepository({
  callWorkoutsApi,
  profileId: "profile-1",
  mapperOptions: {
    fallbackDateKey: "2026-07-01",
    getWorkoutTotals: () => ({ totalSets: 1, totalVolume: 400 })
  }
});

const loaded = await repository.loadWorkouts();
assert.equal(calls[0].action, "load");
assert.deepEqual(calls[0].payload, { profile_id: "profile-1" });
assert.equal(loaded.workouts.length, 1);
assert.equal(loaded.workouts[0].supabaseId, "workout-server-1");
assert.equal(loaded.workouts[0].exercises[0].sets[0].supabaseId, "set-server-1");

const workout = {
  id: "workout-local-1",
  supabaseId: "workout-server-1",
  date: "2026-06-30",
  title: "Pull",
  status: "active",
  durationMinutes: 45,
  exercises: [{
    ...exercise,
    name: "Row",
    sets: [set]
  }]
};

const created = await repository.createWorkoutTree({ ...workout, supabaseId: null });
assert.equal(calls[1].action, "create_workout_tree");
assert.equal(created.payload.workout.title, "Pull");
assert.equal(created.payload.exercises[0].client_id, "exercise-local-1");

const updated = await repository.updateWorkoutTree(workout);
assert.equal(calls[2].action, "update_workout_tree");
assert.equal(updated.payload.workout.id, "workout-server-1");

assert.equal(await repository.updateWorkoutTree({ id: "local-only" }), null);

const saved = await repository.saveWorkoutPatch(workout);
assert.equal(calls[3].action, "save_workout_patch");
assert.equal(saved.payload.workout_updates[0].id, "workout-server-1");

const savedPrebuilt = await repository.saveWorkoutPatch(null, {
  prebuiltPatch: { workout_updates: [{ id: "workout-server-1" }] }
});
assert.equal(calls[4].action, "save_workout_patch");
assert.deepEqual(savedPrebuilt.payload, { workout_updates: [{ id: "workout-server-1" }] });

const deleted = await repository.deleteWorkout(workout);
assert.equal(calls[5].action, "delete_workout");
assert.deepEqual(calls[5].payload, {
  profile_id: "profile-1",
  id: "workout-server-1",
  workout_id: "workout-server-1"
});
assert.equal(deleted.confirmed, true);

const createdExercise = await repository.createExercise("workout-server-1", exercise);
assert.equal(calls[6].action, "create_exercise");
assert.equal(createdExercise.payload.exercise_name, "Row");
assert.equal(createdExercise.payload.exercise.workout_id, "workout-server-1");

const updatedExercise = await repository.updateExercise("workout-server-1", exercise);
assert.equal(calls[7].action, "update_exercise");
assert.equal(updatedExercise.payload.id, "exercise-server-1");

const deletedExercise = await repository.deleteExercise(exercise);
assert.equal(calls[8].action, "delete_exercise");
assert.equal(calls[8].payload.exercise_id, "exercise-server-1");
assert.equal(deletedExercise.confirmed, true);

const createdSet = await repository.createSet("exercise-server-1", set);
assert.equal(calls[9].action, "create_set");
assert.equal(createdSet.payload.set.workout_exercise_id, "exercise-server-1");

const updatedSet = await repository.updateSet("exercise-server-1", set);
assert.equal(calls[10].action, "update_set");
assert.equal(updatedSet.payload.id, "set-server-1");

const deletedSet = await repository.deleteSet(set);
assert.equal(calls[11].action, "delete_set");
assert.equal(calls[11].payload.set_id, "set-server-1");
assert.equal(deletedSet.confirmed, true);

console.log("workout repository checks passed");
