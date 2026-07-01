import { normalizeWorkoutType } from "../domain/index.js";

export function safeWorkoutNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatWorkoutDateKey(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeWorkoutDateKey(value, fallbackDateKey = formatWorkoutDateKey(new Date())) {
  const text = String(value || "").trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatWorkoutDateKey(value);
  return fallbackDateKey;
}

export function getWorkoutDurationSeconds(workout = {}) {
  return Math.max(0, safeWorkoutNumber(workout.durationMinutes) * 60);
}

export function getWorkoutEstimatedCalories(workout = {}) {
  return safeWorkoutNumber(
    workout.estimatedCaloriesBurned ?? workout.estimated_calories_burned ?? workout.calories,
    0
  );
}

export function getWorkoutPatchTotals(workout = {}, getWorkoutTotals) {
  if (typeof getWorkoutTotals === "function") {
    const totals = getWorkoutTotals(workout) || {};
    return {
      totalSets: safeWorkoutNumber(totals.totalSets ?? totals.total_sets, 0),
      totalVolume: safeWorkoutNumber(totals.totalVolume ?? totals.total_volume, 0)
    };
  }

  return {
    totalSets: safeWorkoutNumber(workout.totalSets ?? workout.total_sets, 0),
    totalVolume: safeWorkoutNumber(workout.totalVolume ?? workout.total_volume ?? workout.totalVolumeKg, 0)
  };
}

export function buildWorkoutTotalsPatchPayload(workout, options = {}) {
  if (!workout?.supabaseId) return null;

  const totals = getWorkoutPatchTotals(workout, options.getWorkoutTotals);
  const workoutDateKey = normalizeWorkoutDateKey(
    workout?.date || workout?.workout_date,
    options.fallbackDateKey
  );

  return {
    id: workout.supabaseId,
    workout_date: workoutDateKey,
    total_sets: totals.totalSets,
    total_volume: totals.totalVolume,
    workout_type: normalizeWorkoutType(workout.workoutType ?? workout.workout_type),
    duration_seconds: getWorkoutDurationSeconds(workout),
    estimated_calories_burned: getWorkoutEstimatedCalories(workout),
    started_at: workout.startedAt || workout.started_at || null,
    auto_stopped_at: workout.autoStoppedAt || workout.auto_stopped_at || null
  };
}
