import { getSetStatus, normalizeWorkoutType } from "../domain/index.js";

export function safeWorkoutNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optionalWorkoutNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickSetActualNumber(set, keys = []) {
  for (const key of keys) {
    const value = set?.[key];
    if (value === "" || value === null || value === undefined) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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

export function buildWorkoutSetSupabasePayload(exerciseSupabaseId, set = {}) {
  const actualWeight = pickSetActualNumber(set, ["weight", "weight_kg", "weightValue", "weight_value"]);
  const actualReps = pickSetActualNumber(set, ["reps", "repsValue", "reps_value"]);

  return {
    workout_exercise_id: exerciseSupabaseId,
    set_order: safeWorkoutNumber(set?.order, 1),
    weight_kg: actualWeight,
    reps: actualReps,
    weight_value: actualWeight,
    reps_value: actualReps,
    duration_seconds: safeWorkoutNumber(set?.durationSeconds ?? set?.duration_seconds ?? set?.workTimeSeconds ?? set?.work_time_seconds, 0),
    distance_value: safeWorkoutNumber(set?.distanceValue ?? set?.distance_value, 0),
    manual_calories: optionalWorkoutNumber(set?.manualCalories ?? set?.manual_calories),
    estimated_calories: safeWorkoutNumber(set?.estimatedCalories ?? set?.estimated_calories, 0),
    rir: optionalWorkoutNumber(set?.rir),
    rpe: optionalWorkoutNumber(set?.rpe),
    work_time_seconds: safeWorkoutNumber(set?.workTimeSeconds ?? set?.work_time_seconds, 0),
    rest_seconds: safeWorkoutNumber(set?.restSeconds, 120),
    rest_after_seconds: safeWorkoutNumber(set?.restAfterSeconds, 0),
    tempo: set?.tempo || null,
    is_completed: getSetStatus(set) === "completed",
    notes: set?.note || set?.notes || ""
  };
}

export function buildWorkoutSetPatchPayload(set = {}) {
  if (!set?.supabaseId) return null;
  const { workout_exercise_id, ...setPayload } = buildWorkoutSetSupabasePayload(null, set);
  return {
    id: set.supabaseId,
    ...setPayload
  };
}

export function buildWorkoutSetCreatePayload(exerciseSupabaseId, exerciseClientId, set = {}) {
  if (!exerciseSupabaseId || !set) return null;
  const { workout_exercise_id, ...setPayload } = buildWorkoutSetSupabasePayload(exerciseSupabaseId, set);
  return {
    client_id: set.id,
    exercise_client_id: exerciseClientId,
    workout_exercise_id,
    ...setPayload
  };
}

export function mapSupabaseWorkoutSet(row = {}, index = 0) {
  const completed = Boolean(row.is_completed);
  const weightValue = safeWorkoutNumber(row.weight_kg ?? row.weight ?? row.weightValue ?? row.weight_value);
  const repsValue = safeWorkoutNumber(row.reps ?? row.repsValue ?? row.reps_value);

  return {
    id: `set-supabase-${row.id || index}`,
    supabaseId: row.id || null,
    order: safeWorkoutNumber(row.set_order ?? row.order, index + 1),
    weight: weightValue,
    reps: repsValue,
    weightValue,
    repsValue,
    durationSeconds: safeWorkoutNumber(row.duration_seconds ?? row.durationSeconds ?? row.work_time_seconds ?? row.workTimeSeconds, 0),
    distanceValue: safeWorkoutNumber(row.distance_value ?? row.distanceValue, 0),
    manualCalories: row.manual_calories ?? row.manualCalories ?? null,
    estimatedCalories: safeWorkoutNumber(row.estimated_calories ?? row.estimatedCalories, 0),
    rir: row.rir ?? null,
    rpe: row.rpe ?? null,
    workTimeSeconds: safeWorkoutNumber(row.work_time_seconds ?? row.workTimeSeconds, 0),
    tempo: row.tempo || "",
    type: "working",
    status: row.status || (completed ? "completed" : "pending"),
    note: row.notes || "",
    restSeconds: safeWorkoutNumber(row.rest_seconds ?? row.restSeconds, 120),
    restAfterSeconds: safeWorkoutNumber(row.rest_after_seconds ?? row.restAfterSeconds, 0),
    isCompleted: completed
  };
}
