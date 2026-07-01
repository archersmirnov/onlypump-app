import assert from "node:assert/strict";
import {
  buildWorkoutSetCreatePayload,
  buildWorkoutSetPatchPayload,
  buildWorkoutSetSupabasePayload,
  buildWorkoutTotalsPatchPayload,
  formatWorkoutDateKey,
  getWorkoutDurationSeconds,
  getWorkoutEstimatedCalories,
  getWorkoutPatchTotals,
  mapSupabaseWorkoutSet,
  normalizeWorkoutDateKey,
  optionalWorkoutNumber,
  pickSetActualNumber,
  safeWorkoutNumber
} from "../src/features/workouts/api/index.js";

assert.equal(safeWorkoutNumber("12"), 12);
assert.equal(safeWorkoutNumber("bad", 7), 7);
assert.equal(optionalWorkoutNumber("2.5"), 2.5);
assert.equal(optionalWorkoutNumber(""), null);
assert.equal(optionalWorkoutNumber("bad"), null);
assert.equal(pickSetActualNumber({ weightValue: "95" }, ["weight", "weightValue"]), 95);
assert.equal(pickSetActualNumber({ weight: "", weight_kg: null }, ["weight", "weight_kg"]), null);

assert.equal(formatWorkoutDateKey(new Date(2026, 5, 30)), "2026-06-30");
assert.equal(normalizeWorkoutDateKey("2026-06-30T18:00:00+00:00", "2026-07-01"), "2026-06-30");
assert.equal(normalizeWorkoutDateKey("", "2026-07-01"), "2026-07-01");

assert.equal(getWorkoutDurationSeconds({ durationMinutes: 45 }), 2700);
assert.equal(getWorkoutDurationSeconds({ durationMinutes: -2 }), 0);
assert.equal(getWorkoutEstimatedCalories({ estimatedCaloriesBurned: 320 }), 320);
assert.equal(getWorkoutEstimatedCalories({ estimated_calories_burned: 280 }), 280);
assert.equal(getWorkoutEstimatedCalories({ calories: 190 }), 190);
assert.equal(getWorkoutEstimatedCalories({}), 0);

assert.deepEqual(
  getWorkoutPatchTotals({ totalSets: "5", totalVolumeKg: "1200" }),
  { totalSets: 5, totalVolume: 1200 }
);
assert.deepEqual(
  getWorkoutPatchTotals(
    { totalSets: 0, totalVolumeKg: 0 },
    () => ({ totalSets: "8", totalVolume: "2400" })
  ),
  { totalSets: 8, totalVolume: 2400 }
);

assert.equal(buildWorkoutTotalsPatchPayload({ id: "local" }, { fallbackDateKey: "2026-07-01" }), null);

assert.deepEqual(
  buildWorkoutTotalsPatchPayload(
    {
      supabaseId: "workout-1",
      date: "2026-06-30T18:00:00+00:00",
      workoutType: "bad-type",
      durationMinutes: 60,
      estimatedCaloriesBurned: 410,
      startedAt: "2026-06-30T18:00:00+00:00",
      autoStoppedAt: "",
      totalSets: 3,
      totalVolumeKg: 1500
    },
    { fallbackDateKey: "2026-07-01" }
  ),
  {
    id: "workout-1",
    workout_date: "2026-06-30",
    total_sets: 3,
    total_volume: 1500,
    workout_type: "strength",
    duration_seconds: 3600,
    estimated_calories_burned: 410,
    started_at: "2026-06-30T18:00:00+00:00",
    auto_stopped_at: null
  }
);

assert.deepEqual(
  buildWorkoutSetSupabasePayload("exercise-1", {
    order: "2",
    weightValue: "90",
    reps_value: "8",
    durationSeconds: "45",
    distanceValue: "0.2",
    manualCalories: "",
    estimatedCalories: "18",
    rir: "2",
    rpe: "8.5",
    workTimeSeconds: "35",
    restSeconds: "120",
    restAfterSeconds: "30",
    tempo: "3-1-1",
    status: "completed",
    notes: "clean"
  }),
  {
    workout_exercise_id: "exercise-1",
    set_order: 2,
    weight_kg: 90,
    reps: 8,
    weight_value: 90,
    reps_value: 8,
    duration_seconds: 45,
    distance_value: 0.2,
    manual_calories: null,
    estimated_calories: 18,
    rir: 2,
    rpe: 8.5,
    work_time_seconds: 35,
    rest_seconds: 120,
    rest_after_seconds: 30,
    tempo: "3-1-1",
    is_completed: true,
    notes: "clean"
  }
);

assert.deepEqual(
  buildWorkoutSetPatchPayload({
    supabaseId: "set-1",
    order: 1,
    weight: 100,
    reps: 5,
    isCompleted: true
  }),
  {
    id: "set-1",
    set_order: 1,
    weight_kg: 100,
    reps: 5,
    weight_value: 100,
    reps_value: 5,
    duration_seconds: 0,
    distance_value: 0,
    manual_calories: null,
    estimated_calories: 0,
    rir: null,
    rpe: null,
    work_time_seconds: 0,
    rest_seconds: 120,
    rest_after_seconds: 0,
    tempo: null,
    is_completed: true,
    notes: ""
  }
);

assert.equal(buildWorkoutSetPatchPayload({ id: "local-set" }), null);
assert.equal(buildWorkoutSetCreatePayload(null, "exercise-local", { id: "set-local" }), null);

assert.deepEqual(
  buildWorkoutSetCreatePayload("exercise-1", "exercise-local", {
    id: "set-local",
    order: 1,
    weight_kg: 40,
    reps: 12
  }),
  {
    client_id: "set-local",
    exercise_client_id: "exercise-local",
    workout_exercise_id: "exercise-1",
    set_order: 1,
    weight_kg: 40,
    reps: 12,
    weight_value: 40,
    reps_value: 12,
    duration_seconds: 0,
    distance_value: 0,
    manual_calories: null,
    estimated_calories: 0,
    rir: null,
    rpe: null,
    work_time_seconds: 0,
    rest_seconds: 120,
    rest_after_seconds: 0,
    tempo: null,
    is_completed: false,
    notes: ""
  }
);

assert.deepEqual(
  mapSupabaseWorkoutSet({
    id: "server-set-1",
    set_order: 3,
    weight_kg: "120",
    reps: "6",
    duration_seconds: "30",
    distance_value: "1.5",
    manual_calories: 10,
    estimated_calories: "16",
    rir: 1,
    rpe: 9,
    work_time_seconds: "25",
    tempo: "2-0-1",
    notes: "loaded",
    rest_seconds: "90",
    rest_after_seconds: "20",
    is_completed: true
  }),
  {
    id: "set-supabase-server-set-1",
    supabaseId: "server-set-1",
    order: 3,
    weight: 120,
    reps: 6,
    weightValue: 120,
    repsValue: 6,
    durationSeconds: 30,
    distanceValue: 1.5,
    manualCalories: 10,
    estimatedCalories: 16,
    rir: 1,
    rpe: 9,
    workTimeSeconds: 25,
    tempo: "2-0-1",
    type: "working",
    status: "completed",
    note: "loaded",
    restSeconds: 90,
    restAfterSeconds: 20,
    isCompleted: true
  }
);

console.log("workout mapper checks passed");
