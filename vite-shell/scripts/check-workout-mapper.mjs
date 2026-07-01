import assert from "node:assert/strict";
import {
  buildWorkoutTotalsPatchPayload,
  formatWorkoutDateKey,
  getWorkoutDurationSeconds,
  getWorkoutEstimatedCalories,
  getWorkoutPatchTotals,
  normalizeWorkoutDateKey,
  safeWorkoutNumber
} from "../src/features/workouts/api/index.js";

assert.equal(safeWorkoutNumber("12"), 12);
assert.equal(safeWorkoutNumber("bad", 7), 7);

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

console.log("workout mapper checks passed");
