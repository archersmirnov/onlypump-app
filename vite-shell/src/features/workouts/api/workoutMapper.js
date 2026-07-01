import {
  getExerciseSupersetGroupId,
  getSetStatus,
  normalizeSupersetGroupId,
  normalizeWorkoutStatus,
  normalizeWorkoutSupersetMetadata,
  normalizeWorkoutType
} from "../domain/index.js";

export const DEFAULT_EXERCISE_MEASUREMENT_SETTINGS = Object.freeze({
  sourceExerciseId: null,
  exerciseCategory: "strength",
  primaryMuscles: [],
  secondaryMuscles: [],
  measurementMode: "weight_reps",
  distanceUnit: "km",
  countsInMuscleStats: true,
  measureWeightEnabled: true,
  measureRepsEnabled: true,
  measureTimeEnabled: false,
  measureRirEnabled: false,
  measureRpeEnabled: false,
  weightUnit: "kg",
  doubleCountInStatistics: false
});

export const WORKOUT_WEEKDAY_NAMES = Object.freeze([
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота"
]);

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

function asWorkoutTextArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

export function getWorkoutExerciseMeasurementSettings(exercise = {}, options = {}) {
  const rawSettings = typeof options.normalizeExerciseMeasurementSettings === "function"
    ? options.normalizeExerciseMeasurementSettings(exercise)
    : exercise;
  const settings = rawSettings || {};

  return {
    sourceExerciseId: settings.sourceExerciseId ?? settings.source_exercise_id ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.sourceExerciseId,
    exerciseCategory: settings.exerciseCategory ?? settings.exercise_category ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.exerciseCategory,
    primaryMuscles: asWorkoutTextArray(settings.primaryMuscles ?? settings.primary_muscles),
    secondaryMuscles: asWorkoutTextArray(settings.secondaryMuscles ?? settings.secondary_muscles),
    measurementMode: settings.measurementMode ?? settings.measurement_mode ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.measurementMode,
    distanceUnit: settings.distanceUnit ?? settings.distance_unit ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.distanceUnit,
    countsInMuscleStats: Boolean(settings.countsInMuscleStats ?? settings.counts_in_muscle_stats ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.countsInMuscleStats),
    measureWeightEnabled: Boolean(settings.measureWeightEnabled ?? settings.measure_weight_enabled ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.measureWeightEnabled),
    measureRepsEnabled: Boolean(settings.measureRepsEnabled ?? settings.measure_reps_enabled ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.measureRepsEnabled),
    measureTimeEnabled: Boolean(settings.measureTimeEnabled ?? settings.measure_time_enabled ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.measureTimeEnabled),
    measureRirEnabled: Boolean(settings.measureRirEnabled ?? settings.measure_rir_enabled ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.measureRirEnabled),
    measureRpeEnabled: Boolean(settings.measureRpeEnabled ?? settings.measure_rpe_enabled ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.measureRpeEnabled),
    weightUnit: settings.weightUnit ?? settings.weight_unit ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.weightUnit,
    doubleCountInStatistics: Boolean(
      settings.doubleCountInStatistics
      ?? settings.double_count_in_statistics
      ?? settings.doubleWeightInStats
      ?? settings.double_weight_in_stats
      ?? DEFAULT_EXERCISE_MEASUREMENT_SETTINGS.doubleCountInStatistics
    )
  };
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

export function parseWorkoutDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (year && month && day) return new Date(year, month - 1, day);
  const fallback = new Date(dateKey);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
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

export function getWorkoutCaloriesFromRecord(row = {}) {
  return safeWorkoutNumber(row.estimated_calories_burned ?? row.calories ?? row.caloriesBurned, 0);
}

export function readWorkoutApiArray(result, key, aliases = []) {
  const keys = [key, ...aliases];
  const roots = [result, result?.data, result?.payload, result?.result].filter(Boolean);
  for (const root of roots) {
    for (const itemKey of keys) {
      if (Array.isArray(root?.[itemKey])) return root[itemKey];
    }
  }
  return [];
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

export function isProgramWorkout(workout = {}) {
  return Boolean(
    workout?.isProgramGenerated
    || workout?.userProgramId
    || workout?.userProgramClientId
    || workout?.programName
  );
}

export function buildWorkoutSupabasePayload(workout = {}, options = {}) {
  const totals = getWorkoutPatchTotals(workout, options.getWorkoutTotals);
  const workoutDateKey = normalizeWorkoutDateKey(
    workout?.date || workout?.workout_date,
    options.fallbackDateKey
  );
  const programWorkout = isProgramWorkout(workout);

  return {
    profile_id: options.profileId ?? workout.profileId ?? workout.profile_id,
    client_workout_id: workout?.clientWorkoutId || workout?.client_workout_id || workout?.id,
    workout_date: workoutDateKey,
    title: workout?.title || "Новая тренировка",
    status: normalizeWorkoutStatus(workout?.status),
    workout_type: normalizeWorkoutType(workout?.workoutType ?? workout?.workout_type),
    notes: workout?.notes || "",
    total_sets: totals.totalSets,
    total_volume: totals.totalVolume,
    duration_seconds: getWorkoutDurationSeconds(workout),
    estimated_calories_burned: getWorkoutEstimatedCalories(workout),
    started_at: workout?.startedAt || workout?.started_at || null,
    auto_stopped_at: workout?.autoStoppedAt || workout?.auto_stopped_at || null,
    repeat_group_id: workout?.repeatGroupId || workout?.repeat_group_id || undefined,
    source_workout_id: workout?.sourceWorkoutId || workout?.source_workout_id || undefined,
    ...(programWorkout ? {
      user_program_id: workout?.userProgramId || workout?.user_program_id || undefined,
      user_program_client_id: workout?.userProgramClientId || workout?.user_program_client_id || undefined,
      program_template_workout_id: workout?.programTemplateWorkoutId || workout?.program_template_workout_id || undefined,
      program_template_workout_key: workout?.programTemplateWorkoutKey || workout?.program_template_workout_key || undefined,
      program_week_number: workout?.programWeekNumber ?? workout?.program_week_number,
      program_day_index: workout?.programDayIndex ?? workout?.program_day_index,
      program_name: workout?.programName || workout?.program_name || undefined,
      program_plan_mode: workout?.programPlanMode || workout?.program_plan_mode || undefined,
      program_difficulty: workout?.programDifficulty || workout?.program_difficulty || undefined,
      is_program_generated: true
    } : {})
  };
}

export function buildWorkoutPatchPayload(workout = {}, options = {}) {
  if (!workout?.supabaseId) return null;
  const { profile_id, client_workout_id, ...workoutPayload } = buildWorkoutSupabasePayload(workout, options);
  return {
    id: workout.supabaseId,
    ...workoutPayload
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

export function isProgramWorkoutExercise(exercise = {}) {
  return Boolean(
    exercise?.userProgramExerciseSettingId
    || exercise?.userProgramExerciseSettingClientId
    || exercise?.programTemplateExerciseKey
    || exercise?.plannedSets
  );
}

export function buildWorkoutExerciseSupabasePayload(workoutSupabaseId, exercise = {}, options = {}) {
  const supersetGroupId = getExerciseSupersetGroupId(exercise);
  const measurementSettings = getWorkoutExerciseMeasurementSettings(exercise, options);
  const isProgramExercise = isProgramWorkoutExercise(exercise);

  return {
    workout_id: workoutSupabaseId,
    exercise_name: exercise?.name || "Упражнение",
    muscle_group: exercise?.muscleGroup || "Другое",
    exercise_order: safeWorkoutNumber(exercise?.order, 1),
    notes: exercise?.note || exercise?.notes || "",
    rest_between_seconds: safeWorkoutNumber(exercise?.restSeconds, 120),
    rest_after_seconds: safeWorkoutNumber(exercise?.restAfterSeconds, 0),
    superset_group_id: supersetGroupId,
    superset_order: supersetGroupId ? safeWorkoutNumber(exercise?.supersetOrder, 1) : null,
    is_superset: Boolean(supersetGroupId),
    source_exercise_id: measurementSettings.sourceExerciseId,
    exercise_category: measurementSettings.exerciseCategory,
    primary_muscles: measurementSettings.primaryMuscles,
    secondary_muscles: measurementSettings.secondaryMuscles,
    measurement_mode: measurementSettings.measurementMode,
    distance_unit: measurementSettings.distanceUnit,
    counts_in_muscle_stats: Boolean(measurementSettings.countsInMuscleStats),
    measure_weight_enabled: Boolean(measurementSettings.measureWeightEnabled),
    measure_reps_enabled: Boolean(measurementSettings.measureRepsEnabled),
    measure_time_enabled: Boolean(measurementSettings.measureTimeEnabled),
    measure_rir_enabled: Boolean(measurementSettings.measureRirEnabled),
    measure_rpe_enabled: Boolean(measurementSettings.measureRpeEnabled),
    weight_unit: measurementSettings.weightUnit,
    double_weight_in_stats: Boolean(measurementSettings.doubleCountInStatistics),
    double_count_in_statistics: Boolean(measurementSettings.doubleCountInStatistics),
    ...(isProgramExercise ? {
      user_program_exercise_setting_id: exercise?.userProgramExerciseSettingId || exercise?.user_program_exercise_setting_id || undefined,
      user_program_exercise_setting_client_id: exercise?.userProgramExerciseSettingClientId || exercise?.user_program_exercise_setting_client_id || undefined,
      program_template_exercise_id: exercise?.programTemplateExerciseId || exercise?.program_template_exercise_id || undefined,
      program_template_exercise_key: exercise?.programTemplateExerciseKey || exercise?.program_template_exercise_key || undefined,
      planned_sets: exercise?.plannedSets ?? exercise?.planned_sets,
      planned_rep_min: exercise?.plannedRepMin ?? exercise?.planned_rep_min,
      planned_rep_max: exercise?.plannedRepMax ?? exercise?.planned_rep_max,
      planned_weight: exercise?.plannedWeight ?? exercise?.planned_weight,
      planned_reps: exercise?.plannedReps ?? exercise?.planned_reps,
      progression_state: exercise?.progressionState || exercise?.progression_state || undefined
    } : {})
  };
}

export function buildWorkoutExercisePatchPayload(exercise = {}, options = {}) {
  if (!exercise?.supabaseId) return null;
  const { workout_id, ...exercisePayload } = buildWorkoutExerciseSupabasePayload(null, exercise, options);
  return {
    id: exercise.supabaseId,
    ...exercisePayload
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

export function buildWorkoutExerciseCreatePayload(workoutSupabaseId, exercise = {}, options = {}) {
  if (!workoutSupabaseId || !exercise) return null;
  const { workout_id, ...exercisePayload } = buildWorkoutExerciseSupabasePayload(workoutSupabaseId, exercise, options);
  return {
    client_id: exercise.id,
    workout_id,
    ...exercisePayload,
    sets: (exercise.sets || []).map((set) => {
      const { workout_exercise_id, ...setPayload } = buildWorkoutSetSupabasePayload(null, set);
      return {
        client_id: set.id,
        ...setPayload
      };
    })
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

function resolveWorkoutExerciseImageUrl(row, systemSource, options) {
  if (typeof options.getExerciseImageUrlFromSource === "function") {
    return options.getExerciseImageUrlFromSource(row, systemSource);
  }
  return row.exercise_image_url || row.exerciseImageUrl || systemSource?.exerciseImageUrl || "";
}

function resolveWorkoutMuscleWorkImageKey(row, systemSource, options) {
  if (row.muscle_work_image_key || row.muscleWorkImageKey) return row.muscle_work_image_key || row.muscleWorkImageKey;
  if (typeof options.getOnlypumpMuscleWorkImageKey === "function") {
    return options.getOnlypumpMuscleWorkImageKey({ ...(systemSource || {}), ...row });
  }
  return systemSource?.muscleWorkImageKey || systemSource?.muscle_work_image_key || "";
}

function resolveWorkoutMuscleWorkImageUrl(row, systemSource, options) {
  if (typeof options.getMuscleWorkImageUrlFromSource === "function") {
    return options.getMuscleWorkImageUrlFromSource(row, systemSource);
  }
  return row.muscle_work_image_url || row.muscleWorkImageUrl || systemSource?.muscleWorkImageUrl || "";
}

export function mapSupabaseWorkoutExercise(row = {}, index = 0, options = {}) {
  const supersetGroupId = normalizeSupersetGroupId(row.superset_group_id || row.supersetGroupId || row.supersetId);
  const sets = row.workout_sets || row.sets || row.workoutSets || [];
  const exerciseName = row.exercise_name || row.name || row.exerciseName || "Упражнение";
  const systemSource = typeof options.findSystemExerciseByName === "function"
    ? options.findSystemExerciseByName(exerciseName)
    : null;
  const measurementSettings = getWorkoutExerciseMeasurementSettings({
    ...(systemSource || {}),
    ...row,
    primaryMuscles: row.primary_muscles || row.primaryMuscles || systemSource?.primaryMuscles,
    secondaryMuscles: row.secondary_muscles || row.secondaryMuscles || systemSource?.secondaryMuscles
  }, options);

  return {
    id: `exercise-supabase-${row.id || index}`,
    supabaseId: row.id || null,
    order: safeWorkoutNumber(row.exercise_order ?? row.order, index + 1),
    name: systemSource?.name || exerciseName,
    muscleGroup: row.muscle_group || row.muscleGroup || systemSource?.muscleGroup || "Другое",
    blockType: "обычное",
    restSeconds: safeWorkoutNumber(row.rest_between_seconds ?? row.restSeconds, 120),
    restAfterSeconds: safeWorkoutNumber(row.rest_after_seconds ?? row.restAfterSeconds, 0),
    supersetId: supersetGroupId,
    supersetGroupId,
    supersetOrder: supersetGroupId ? safeWorkoutNumber(row.superset_order ?? row.supersetOrder, index + 1) : null,
    isSuperset: Boolean(row.is_superset || supersetGroupId),
    userProgramExerciseSettingId: row.user_program_exercise_setting_id || row.userProgramExerciseSettingId || null,
    userProgramExerciseSettingClientId: row.user_program_exercise_setting_client_id || row.userProgramExerciseSettingClientId || null,
    programTemplateExerciseId: row.program_template_exercise_id || row.programTemplateExerciseId || null,
    programTemplateExerciseKey: row.program_template_exercise_key || row.programTemplateExerciseKey || null,
    plannedSets: row.planned_sets ?? row.plannedSets ?? null,
    plannedRepMin: row.planned_rep_min ?? row.plannedRepMin ?? null,
    plannedRepMax: row.planned_rep_max ?? row.plannedRepMax ?? null,
    plannedWeight: row.planned_weight ?? row.plannedWeight ?? null,
    plannedReps: row.planned_reps ?? row.plannedReps ?? null,
    progressionState: row.progression_state || row.progressionState || null,
    ...measurementSettings,
    description: row.description || row.exercise_description || systemSource?.description || "",
    instruction: row.instruction || row.description || systemSource?.instruction || systemSource?.description || "",
    techniqueDescription: row.technique_description || row.techniqueDescription || row.description || systemSource?.techniqueDescription || systemSource?.description || "",
    exerciseImageUrl: resolveWorkoutExerciseImageUrl(row, systemSource, options),
    muscleWorkImageKey: resolveWorkoutMuscleWorkImageKey(row, systemSource, options),
    muscleWorkImageUrl: resolveWorkoutMuscleWorkImageUrl(row, systemSource, options),
    muscleWorkVideoUrl: row.muscle_work_video_url || row.muscleWorkVideoUrl || "",
    techniqueVideoUrl: row.technique_video_url || row.techniqueVideoUrl || "",
    note: row.notes || "",
    sets: [...sets]
      .sort((a, b) => safeWorkoutNumber(a.set_order ?? a.order) - safeWorkoutNumber(b.set_order ?? b.order))
      .map((set, setIndex) => mapSupabaseWorkoutSet(set, setIndex))
  };
}

export function mapSupabaseWorkout(row = {}, index = 0, options = {}) {
  const fallbackDateKey = options.fallbackDateKey ?? formatWorkoutDateKey(new Date());
  const dateKey = normalizeWorkoutDateKey(row.workout_date || row.date, fallbackDateKey);
  const date = parseWorkoutDateKey(dateKey);
  const exercises = row.workout_exercises || row.exercises || row.workoutExercises || [];
  const mappedExercises = [...exercises]
    .sort((a, b) => safeWorkoutNumber(a.exercise_order ?? a.order) - safeWorkoutNumber(b.exercise_order ?? b.order))
    .map((exercise, exerciseIndex) => mapSupabaseWorkoutExercise(exercise, exerciseIndex, options));
  const derivedTotals = typeof options.getWorkoutTotals === "function"
    ? options.getWorkoutTotals({ exercises: mappedExercises }) || {}
    : getWorkoutPatchTotals(row);
  const serverTotalSets = safeWorkoutNumber(row.total_sets ?? row.totalSets, 0);
  const serverTotalVolume = safeWorkoutNumber(row.total_volume ?? row.totalVolume ?? row.totalVolumeKg, 0);
  const status = normalizeWorkoutStatus(row.status);
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();
  const startedAt = row.started_at || row.startedAt || (status === "active" ? createdAt : null);
  const weekdayNames = options.weekdayNames || WORKOUT_WEEKDAY_NAMES;

  return normalizeWorkoutSupersetMetadata({
    id: `workout-supabase-${row.id || index}`,
    supabaseId: row.id || null,
    clientWorkoutId: row.client_workout_id || row.clientWorkoutId || null,
    date: dateKey,
    weekday: weekdayNames[date.getDay()] || "",
    title: row.title || "Новая тренировка",
    workoutType: normalizeWorkoutType(row.workout_type ?? row.workoutType),
    programDayNumber: index + 1,
    durationMinutes: safeWorkoutNumber(row.duration_minutes ?? row.durationMinutes ?? (row.duration_seconds !== undefined ? Number(row.duration_seconds) / 60 : undefined), 0),
    totalVolumeKg: safeWorkoutNumber(derivedTotals.totalVolume ?? derivedTotals.total_volume, 0),
    serverTotalSets,
    serverTotalVolume,
    calories: getWorkoutCaloriesFromRecord(row),
    estimatedCaloriesBurned: getWorkoutCaloriesFromRecord(row),
    status,
    startedAt,
    autoStoppedAt: row.auto_stopped_at || row.autoStoppedAt || null,
    exercises: mappedExercises,
    notes: row.notes || "",
    templateId: row.template_id || row.templateId || null,
    userProgramId: row.user_program_id || row.userProgramId || null,
    userProgramClientId: row.user_program_client_id || row.userProgramClientId || null,
    programTemplateWorkoutId: row.program_template_workout_id || row.programTemplateWorkoutId || null,
    programTemplateWorkoutKey: row.program_template_workout_key || row.programTemplateWorkoutKey || null,
    programWeekNumber: row.program_week_number ?? row.programWeekNumber ?? null,
    programDayIndex: row.program_day_index ?? row.programDayIndex ?? null,
    programName: row.program_name || row.programName || null,
    programPlanMode: row.program_plan_mode || row.programPlanMode || null,
    programDifficulty: row.program_difficulty || row.programDifficulty || null,
    isProgramGenerated: Boolean(row.is_program_generated || row.isProgramGenerated),
    createdAt,
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
  });
}

export function buildWorkoutTreeFromApi(result, options = {}) {
  const apiWorkouts = readWorkoutApiArray(result, "workouts", ["workoutRows"]);
  const apiExercises = readWorkoutApiArray(result, "workout_exercises", ["exercises", "workoutExercises", "exerciseRows"]);
  const apiSets = readWorkoutApiArray(result, "workout_sets", ["sets", "workoutSets", "setRows"]);

  if (!apiExercises.length && !apiSets.length) {
    return apiWorkouts.map((workout, index) => mapSupabaseWorkout(workout, index, options));
  }

  const setsByExerciseId = apiSets.reduce((map, set) => {
    const exerciseId = set?.workout_exercise_id || set?.workoutExerciseId || set?.exercise_id || set?.exerciseId;
    if (!exerciseId) return map;
    const key = String(exerciseId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(set);
    return map;
  }, new Map());

  const exercisesByWorkoutId = apiExercises.reduce((map, exercise) => {
    const workoutId = exercise?.workout_id || exercise?.workoutId || exercise?.workout?.id;
    if (!workoutId) return map;
    const exerciseId = exercise?.id || exercise?.workout_exercise_id || exercise?.exercise_id;
    const key = String(workoutId);
    const setRows = exerciseId ? (setsByExerciseId.get(String(exerciseId)) || []) : [];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      ...exercise,
      workout_sets: setRows.length ? setRows : (exercise?.workout_sets || exercise?.sets || [])
    });
    return map;
  }, new Map());

  return apiWorkouts.map((workout, index) => {
    const workoutId = workout?.id || workout?.workout_id || workout?.workoutId;
    const exerciseRows = workoutId ? (exercisesByWorkoutId.get(String(workoutId)) || []) : [];
    return mapSupabaseWorkout({
      ...workout,
      workout_exercises: exerciseRows.length ? exerciseRows : (workout?.workout_exercises || workout?.exercises || [])
    }, index, options);
  });
}

export function isPendingRemoteCreate(item = {}) {
  return Boolean(item?.pending || item?.isSaving || item?.isSyncing);
}

export function buildWorkoutTreePatch(workout = {}, options = {}) {
  if (!workout?.supabaseId) return null;
  const normalizedWorkout = normalizeWorkoutSupersetMetadata(workout);
  const exercises = normalizedWorkout.exercises || [];
  const savedExercises = exercises.filter((exercise) => exercise.supabaseId);
  const missingExercises = exercises.filter((exercise) => !exercise.supabaseId);

  return {
    workout_updates: [buildWorkoutPatchPayload(normalizedWorkout, options)].filter(Boolean),
    exercise_updates: savedExercises.map((exercise) => buildWorkoutExercisePatchPayload(exercise, options)).filter(Boolean),
    set_updates: savedExercises.flatMap((exercise) => (
      exercise.sets || []
    ).filter((set) => set.supabaseId).map(buildWorkoutSetPatchPayload).filter(Boolean)),
    exercise_creates: missingExercises
      .filter(isPendingRemoteCreate)
      .map((exercise) => buildWorkoutExerciseCreatePayload(normalizedWorkout.supabaseId, exercise, options))
      .filter(Boolean),
    exercise_upserts: missingExercises
      .filter((exercise) => !isPendingRemoteCreate(exercise))
      .map((exercise) => buildWorkoutExerciseCreatePayload(normalizedWorkout.supabaseId, exercise, options))
      .filter(Boolean),
    set_creates: savedExercises.flatMap((exercise) => (
      exercise.sets || []
    )
      .filter((set) => !set.supabaseId && isPendingRemoteCreate(set))
      .map((set) => buildWorkoutSetCreatePayload(exercise.supabaseId, exercise.id, set))
      .filter(Boolean)),
    set_upserts: savedExercises.flatMap((exercise) => (
      exercise.sets || []
    )
      .filter((set) => !set.supabaseId && !isPendingRemoteCreate(set))
      .map((set) => buildWorkoutSetCreatePayload(exercise.supabaseId, exercise.id, set))
      .filter(Boolean))
  };
}

export function buildWorkoutTreeCreatePayload(workout = {}, options = {}) {
  const normalizedWorkout = normalizeWorkoutSupersetMetadata(workout);
  const { profile_id, ...workoutPayload } = buildWorkoutSupabasePayload(normalizedWorkout, options);

  return {
    workout: {
      ...workoutPayload,
      duration_seconds: getWorkoutDurationSeconds(normalizedWorkout)
    },
    exercises: (normalizedWorkout.exercises || []).map((exercise) => {
      const { workout_id, ...exercisePayload } = buildWorkoutExerciseSupabasePayload(null, exercise, options);
      return {
        client_id: exercise.id,
        ...exercisePayload,
        sets: (exercise.sets || []).map((set) => {
          const { workout_exercise_id, ...setPayload } = buildWorkoutSetSupabasePayload(null, set);
          return {
            client_id: set.id,
            ...setPayload
          };
        })
      };
    })
  };
}

export function buildWorkoutTreeUpdatePayload(workout = {}, options = {}) {
  const normalizedWorkout = normalizeWorkoutSupersetMetadata(workout);

  return {
    workout: buildWorkoutPatchPayload(normalizedWorkout, options),
    exercises: (normalizedWorkout.exercises || []).map((exercise) => ({
      client_id: exercise.id,
      ...buildWorkoutExercisePatchPayload(exercise, options),
      sets: (exercise.sets || []).map((set) => ({
        client_id: set.id,
        ...buildWorkoutSetPatchPayload(set)
      }))
    }))
  };
}
