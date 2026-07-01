import assert from "node:assert/strict";
import {
  buildWorkoutDeletePayload,
  buildWorkoutLoadPayload,
  createWorkoutRepository,
  isWorkoutDeleteResponseConfirmed,
  requireWorkoutApiCaller,
  resolveWorkoutProfileId,
  WORKOUT_REPOSITORY_ACTIONS
} from "../src/features/workouts/api/index.js";

assert.equal(WORKOUT_REPOSITORY_ACTIONS.load, "load");
assert.equal(WORKOUT_REPOSITORY_ACTIONS.createWorkoutTree, "create_workout_tree");
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
    id: "exercise-local-1",
    supabaseId: "exercise-server-1",
    name: "Row",
    sets: [{ id: "set-local-1", supabaseId: "set-server-1", order: 1, weight: 40, reps: 10 }]
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

console.log("workout repository checks passed");
