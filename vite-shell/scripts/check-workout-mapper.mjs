import assert from "node:assert/strict";
import {
  buildWorkoutExerciseCreatePayload,
  buildWorkoutExercisePatchPayload,
  buildWorkoutExerciseSupabasePayload,
  buildWorkoutPatchPayload,
  buildWorkoutSetCreatePayload,
  buildWorkoutSetPatchPayload,
  buildWorkoutSetSupabasePayload,
  buildWorkoutTotalsPatchPayload,
  buildWorkoutSupabasePayload,
  buildWorkoutTreeCreatePayload,
  buildWorkoutTreePatch,
  buildWorkoutTreeUpdatePayload,
  buildWorkoutTreeFromApi,
  formatWorkoutDateKey,
  getWorkoutDurationSeconds,
  getWorkoutExerciseMeasurementSettings,
  getWorkoutEstimatedCalories,
  getWorkoutPatchTotals,
  getWorkoutCaloriesFromRecord,
  isPendingRemoteCreate,
  isProgramWorkout,
  isProgramWorkoutExercise,
  mapSupabaseWorkout,
  mapSupabaseWorkoutExercise,
  mapSupabaseWorkoutSet,
  normalizeWorkoutDateKey,
  optionalWorkoutNumber,
  pickSetActualNumber,
  readWorkoutApiArray,
  safeWorkoutNumber
} from "../src/features/workouts/api/index.js";

assert.equal(safeWorkoutNumber("12"), 12);
assert.equal(safeWorkoutNumber("bad", 7), 7);
assert.equal(optionalWorkoutNumber("2.5"), 2.5);
assert.equal(optionalWorkoutNumber(""), null);
assert.equal(optionalWorkoutNumber("bad"), null);
assert.equal(pickSetActualNumber({ weightValue: "95" }, ["weight", "weightValue"]), 95);
assert.equal(pickSetActualNumber({ weight: "", weight_kg: null }, ["weight", "weight_kg"]), null);

assert.deepEqual(
  getWorkoutExerciseMeasurementSettings({
    source_exercise_id: "source-1",
    exercise_category: "strength",
    primary_muscles: "Back, Lats",
    secondary_muscles: ["Biceps"],
    measurement_mode: "weight_reps",
    distance_unit: "km",
    counts_in_muscle_stats: false,
    measure_weight_enabled: true,
    measure_reps_enabled: false,
    measure_time_enabled: true,
    measure_rir_enabled: true,
    measure_rpe_enabled: false,
    weight_unit: "lb",
    double_count_in_statistics: true
  }),
  {
    sourceExerciseId: "source-1",
    exerciseCategory: "strength",
    primaryMuscles: ["Back", "Lats"],
    secondaryMuscles: ["Biceps"],
    measurementMode: "weight_reps",
    distanceUnit: "km",
    countsInMuscleStats: false,
    measureWeightEnabled: true,
    measureRepsEnabled: false,
    measureTimeEnabled: true,
    measureRirEnabled: true,
    measureRpeEnabled: false,
    weightUnit: "lb",
    doubleCountInStatistics: true
  }
);

assert.equal(formatWorkoutDateKey(new Date(2026, 5, 30)), "2026-06-30");
assert.equal(normalizeWorkoutDateKey("2026-06-30T18:00:00+00:00", "2026-07-01"), "2026-06-30");
assert.equal(normalizeWorkoutDateKey("", "2026-07-01"), "2026-07-01");

assert.equal(getWorkoutDurationSeconds({ durationMinutes: 45 }), 2700);
assert.equal(getWorkoutDurationSeconds({ durationMinutes: -2 }), 0);
assert.equal(getWorkoutEstimatedCalories({ estimatedCaloriesBurned: 320 }), 320);
assert.equal(getWorkoutEstimatedCalories({ estimated_calories_burned: 280 }), 280);
assert.equal(getWorkoutEstimatedCalories({ calories: 190 }), 190);
assert.equal(getWorkoutEstimatedCalories({}), 0);
assert.equal(getWorkoutCaloriesFromRecord({ estimated_calories_burned: "225" }), 225);
assert.equal(getWorkoutCaloriesFromRecord({ caloriesBurned: "120" }), 120);
assert.deepEqual(readWorkoutApiArray({ data: { workouts: [1, 2] } }, "workouts"), [1, 2]);
assert.deepEqual(readWorkoutApiArray({ payload: { workoutRows: [3] } }, "workouts", ["workoutRows"]), [3]);

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

const supersetGroupId = "11111111-1111-4111-8111-111111111111";
const exerciseMeasurementOptions = {
  normalizeExerciseMeasurementSettings: () => ({
    sourceExerciseId: "22222222-2222-4222-8222-222222222222",
    exerciseCategory: "strength",
    primaryMuscles: ["Back"],
    secondaryMuscles: ["Biceps"],
    measurementMode: "weight_reps",
    distanceUnit: "km",
    countsInMuscleStats: true,
    measureWeightEnabled: true,
    measureRepsEnabled: true,
    measureTimeEnabled: false,
    measureRirEnabled: true,
    measureRpeEnabled: true,
    weightUnit: "kg",
    doubleCountInStatistics: true
  })
};
const exerciseFixture = {
  id: "exercise-local-1",
  supabaseId: "exercise-server-1",
  name: "Row",
  muscleGroup: "Back",
  order: "2",
  note: "focus",
  restSeconds: "150",
  restAfterSeconds: "45",
  supersetGroupId,
  supersetOrder: "3",
  userProgramExerciseSettingId: "program-setting-1",
  userProgramExerciseSettingClientId: "program-setting-client-1",
  programTemplateExerciseId: "template-exercise-1",
  programTemplateExerciseKey: "template-key-1",
  plannedSets: 4,
  plannedRepMin: 8,
  plannedRepMax: 12,
  plannedWeight: 80,
  plannedReps: 10,
  progressionState: "ready",
  sets: [{ id: "set-local-1", order: 1, weight: 80, reps: 10, status: "completed" }]
};

assert.equal(isProgramWorkoutExercise(exerciseFixture), true);
assert.equal(isProgramWorkoutExercise({ name: "Free exercise" }), false);

assert.deepEqual(
  buildWorkoutExerciseSupabasePayload("workout-1", exerciseFixture, exerciseMeasurementOptions),
  {
    workout_id: "workout-1",
    exercise_name: "Row",
    muscle_group: "Back",
    exercise_order: 2,
    notes: "focus",
    rest_between_seconds: 150,
    rest_after_seconds: 45,
    superset_group_id: supersetGroupId,
    superset_order: 3,
    is_superset: true,
    source_exercise_id: "22222222-2222-4222-8222-222222222222",
    exercise_category: "strength",
    primary_muscles: ["Back"],
    secondary_muscles: ["Biceps"],
    measurement_mode: "weight_reps",
    distance_unit: "km",
    counts_in_muscle_stats: true,
    measure_weight_enabled: true,
    measure_reps_enabled: true,
    measure_time_enabled: false,
    measure_rir_enabled: true,
    measure_rpe_enabled: true,
    weight_unit: "kg",
    double_weight_in_stats: true,
    double_count_in_statistics: true,
    user_program_exercise_setting_id: "program-setting-1",
    user_program_exercise_setting_client_id: "program-setting-client-1",
    program_template_exercise_id: "template-exercise-1",
    program_template_exercise_key: "template-key-1",
    planned_sets: 4,
    planned_rep_min: 8,
    planned_rep_max: 12,
    planned_weight: 80,
    planned_reps: 10,
    progression_state: "ready"
  }
);

assert.equal(buildWorkoutExercisePatchPayload({ id: "exercise-local" }), null);
assert.deepEqual(
  buildWorkoutExercisePatchPayload(exerciseFixture, exerciseMeasurementOptions),
  {
    id: "exercise-server-1",
    exercise_name: "Row",
    muscle_group: "Back",
    exercise_order: 2,
    notes: "focus",
    rest_between_seconds: 150,
    rest_after_seconds: 45,
    superset_group_id: supersetGroupId,
    superset_order: 3,
    is_superset: true,
    source_exercise_id: "22222222-2222-4222-8222-222222222222",
    exercise_category: "strength",
    primary_muscles: ["Back"],
    secondary_muscles: ["Biceps"],
    measurement_mode: "weight_reps",
    distance_unit: "km",
    counts_in_muscle_stats: true,
    measure_weight_enabled: true,
    measure_reps_enabled: true,
    measure_time_enabled: false,
    measure_rir_enabled: true,
    measure_rpe_enabled: true,
    weight_unit: "kg",
    double_weight_in_stats: true,
    double_count_in_statistics: true,
    user_program_exercise_setting_id: "program-setting-1",
    user_program_exercise_setting_client_id: "program-setting-client-1",
    program_template_exercise_id: "template-exercise-1",
    program_template_exercise_key: "template-key-1",
    planned_sets: 4,
    planned_rep_min: 8,
    planned_rep_max: 12,
    planned_weight: 80,
    planned_reps: 10,
    progression_state: "ready"
  }
);

assert.equal(buildWorkoutExerciseCreatePayload(null, exerciseFixture, exerciseMeasurementOptions), null);
assert.deepEqual(
  buildWorkoutExerciseCreatePayload("workout-1", exerciseFixture, exerciseMeasurementOptions),
  {
    client_id: "exercise-local-1",
    workout_id: "workout-1",
    exercise_name: "Row",
    muscle_group: "Back",
    exercise_order: 2,
    notes: "focus",
    rest_between_seconds: 150,
    rest_after_seconds: 45,
    superset_group_id: supersetGroupId,
    superset_order: 3,
    is_superset: true,
    source_exercise_id: "22222222-2222-4222-8222-222222222222",
    exercise_category: "strength",
    primary_muscles: ["Back"],
    secondary_muscles: ["Biceps"],
    measurement_mode: "weight_reps",
    distance_unit: "km",
    counts_in_muscle_stats: true,
    measure_weight_enabled: true,
    measure_reps_enabled: true,
    measure_time_enabled: false,
    measure_rir_enabled: true,
    measure_rpe_enabled: true,
    weight_unit: "kg",
    double_weight_in_stats: true,
    double_count_in_statistics: true,
    user_program_exercise_setting_id: "program-setting-1",
    user_program_exercise_setting_client_id: "program-setting-client-1",
    program_template_exercise_id: "template-exercise-1",
    program_template_exercise_key: "template-key-1",
    planned_sets: 4,
    planned_rep_min: 8,
    planned_rep_max: 12,
    planned_weight: 80,
    planned_reps: 10,
    progression_state: "ready",
    sets: [{
      client_id: "set-local-1",
      set_order: 1,
      weight_kg: 80,
      reps: 10,
      weight_value: 80,
      reps_value: 10,
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
    }]
  }
);

const workoutFixture = {
  id: "workout-local-1",
  supabaseId: "workout-server-1",
  clientWorkoutId: "client-workout-1",
  date: "2026-06-30T18:00:00+00:00",
  title: "Pull",
  status: "in_progress",
  workoutType: "strength",
  notes: "workout note",
  durationMinutes: 50,
  estimatedCaloriesBurned: 350,
  startedAt: "2026-06-30T18:00:00+00:00",
  autoStoppedAt: null,
  repeatGroupId: "repeat-1",
  sourceWorkoutId: "source-workout-1",
  userProgramId: "program-1",
  userProgramClientId: "program-client-1",
  programTemplateWorkoutId: "template-workout-1",
  programTemplateWorkoutKey: "template-workout-key-1",
  programWeekNumber: 2,
  programDayIndex: 1,
  programName: "Program",
  programPlanMode: "calendar",
  programDifficulty: "medium",
  exercises: [exerciseFixture]
};
const workoutPayloadOptions = {
  ...exerciseMeasurementOptions,
  profileId: "profile-1",
  fallbackDateKey: "2026-07-01",
  getWorkoutTotals: () => ({ totalSets: "7", totalVolume: "12345" })
};

assert.equal(isProgramWorkout(workoutFixture), true);
assert.equal(isProgramWorkout({ title: "Free workout" }), false);
assert.equal(isPendingRemoteCreate({ pending: true }), true);
assert.equal(isPendingRemoteCreate({ isSaving: true }), true);
assert.equal(isPendingRemoteCreate({ isSyncing: true }), true);
assert.equal(isPendingRemoteCreate({}), false);

const workoutSupabasePayload = buildWorkoutSupabasePayload(workoutFixture, workoutPayloadOptions);
assert.equal(workoutSupabasePayload.profile_id, "profile-1");
assert.equal(workoutSupabasePayload.client_workout_id, "client-workout-1");
assert.equal(workoutSupabasePayload.workout_date, "2026-06-30");
assert.equal(workoutSupabasePayload.status, "active");
assert.equal(workoutSupabasePayload.total_sets, 7);
assert.equal(workoutSupabasePayload.total_volume, 12345);
assert.equal(workoutSupabasePayload.duration_seconds, 3000);
assert.equal(workoutSupabasePayload.is_program_generated, true);
assert.equal(workoutSupabasePayload.program_name, "Program");

const workoutPatchPayload = buildWorkoutPatchPayload(workoutFixture, workoutPayloadOptions);
assert.equal(workoutPatchPayload.id, "workout-server-1");
assert.equal(workoutPatchPayload.workout_date, "2026-06-30");
assert.equal(workoutPatchPayload.status, "active");
assert.equal("profile_id" in workoutPatchPayload, false);
assert.equal("client_workout_id" in workoutPatchPayload, false);
assert.equal(buildWorkoutPatchPayload({ id: "local" }, workoutPayloadOptions), null);

const createTreePayload = buildWorkoutTreeCreatePayload(
  {
    ...workoutFixture,
    supabaseId: null,
    exercises: [{
      ...exerciseFixture,
      supabaseId: null,
      supersetGroupId: null,
      sets: [{ id: "set-local-1", order: 1, weight: 80, reps: 10, status: "completed" }]
    }]
  },
  workoutPayloadOptions
);
assert.equal(createTreePayload.workout.title, "Pull");
assert.equal(createTreePayload.workout.duration_seconds, 3000);
assert.equal("profile_id" in createTreePayload.workout, false);
assert.equal(createTreePayload.exercises.length, 1);
assert.equal(createTreePayload.exercises[0].client_id, "exercise-local-1");
assert.equal(createTreePayload.exercises[0].sets.length, 1);
assert.equal(createTreePayload.exercises[0].sets[0].client_id, "set-local-1");

const patchTreePayload = buildWorkoutTreePatch(
  {
    ...workoutFixture,
    exercises: [
      {
        ...exerciseFixture,
        supersetGroupId: null,
        sets: [
          { id: "set-saved-local", supabaseId: "set-server-1", order: 1, weight: 90, reps: 8 },
          { id: "set-create-local", pending: true, order: 2, weight: 80, reps: 10 },
          { id: "set-upsert-local", order: 3, weight: 70, reps: 12 }
        ]
      },
      { id: "exercise-create-local", pending: true, name: "New pending", sets: [] },
      { id: "exercise-upsert-local", name: "New upsert", sets: [] }
    ]
  },
  workoutPayloadOptions
);
assert.equal(patchTreePayload.workout_updates.length, 1);
assert.equal(patchTreePayload.exercise_updates.length, 1);
assert.equal(patchTreePayload.set_updates.length, 1);
assert.equal(patchTreePayload.exercise_creates.length, 1);
assert.equal(patchTreePayload.exercise_upserts.length, 1);
assert.equal(patchTreePayload.set_creates.length, 1);
assert.equal(patchTreePayload.set_upserts.length, 1);
assert.equal(buildWorkoutTreePatch({ id: "local-only" }, workoutPayloadOptions), null);

const updateTreePayload = buildWorkoutTreeUpdatePayload(workoutFixture, workoutPayloadOptions);
assert.equal(updateTreePayload.workout.id, "workout-server-1");
assert.equal(updateTreePayload.exercises[0].client_id, "exercise-local-1");
assert.equal(updateTreePayload.exercises[0].id, "exercise-server-1");
assert.equal(updateTreePayload.exercises[0].sets.length, 1);

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

const readMapperOptions = {
  fallbackDateKey: "2026-07-01",
  findSystemExerciseByName: (name) => name === "Lat Pulldown" ? {
    name: "Lat Pulldown",
    muscleGroup: "Back",
    primaryMuscles: ["Back"],
    secondaryMuscles: ["Biceps"],
    exerciseImageUrl: "system-image.png",
    muscleWorkImageKey: "system-muscles",
    muscleWorkImageUrl: "system-muscles.png",
    description: "system description"
  } : null,
  normalizeExerciseMeasurementSettings: (source) => ({
    sourceExerciseId: source.source_exercise_id || null,
    exerciseCategory: source.exercise_category || "strength",
    primaryMuscles: source.primaryMuscles || source.primary_muscles || [],
    secondaryMuscles: source.secondaryMuscles || source.secondary_muscles || [],
    measurementMode: source.measurement_mode || "weight_reps",
    distanceUnit: source.distance_unit || "km",
    countsInMuscleStats: source.counts_in_muscle_stats ?? true,
    measureWeightEnabled: source.measure_weight_enabled ?? true,
    measureRepsEnabled: source.measure_reps_enabled ?? true,
    measureTimeEnabled: source.measure_time_enabled ?? false,
    measureRirEnabled: source.measure_rir_enabled ?? false,
    measureRpeEnabled: source.measure_rpe_enabled ?? false,
    weightUnit: source.weight_unit || "kg",
    doubleCountInStatistics: source.double_count_in_statistics ?? false
  }),
  getWorkoutTotals: () => ({ totalSets: 2, totalVolume: 960 })
};

const mappedExercise = mapSupabaseWorkoutExercise({
  id: "exercise-server-2",
  exercise_name: "Lat Pulldown",
  exercise_order: 2,
  muscle_group: "Pull",
  rest_between_seconds: "150",
  rest_after_seconds: "20",
  superset_group_id: supersetGroupId,
  superset_order: "1",
  is_superset: true,
  user_program_exercise_setting_id: "setting-2",
  planned_sets: 3,
  primary_muscles: ["Back"],
  secondary_muscles: ["Biceps"],
  description: "row description",
  notes: "row note",
  workout_sets: [
    { id: "set-b", set_order: 2, weight_kg: 50, reps: 8 },
    { id: "set-a", set_order: 1, weight_kg: 45, reps: 10, is_completed: true }
  ]
}, 0, readMapperOptions);

assert.equal(mappedExercise.id, "exercise-supabase-exercise-server-2");
assert.equal(mappedExercise.supabaseId, "exercise-server-2");
assert.equal(mappedExercise.name, "Lat Pulldown");
assert.equal(mappedExercise.muscleGroup, "Pull");
assert.equal(mappedExercise.restSeconds, 150);
assert.equal(mappedExercise.restAfterSeconds, 20);
assert.equal(mappedExercise.supersetGroupId, supersetGroupId);
assert.equal(mappedExercise.supersetOrder, 1);
assert.equal(mappedExercise.isSuperset, true);
assert.equal(mappedExercise.userProgramExerciseSettingId, "setting-2");
assert.equal(mappedExercise.plannedSets, 3);
assert.deepEqual(mappedExercise.primaryMuscles, ["Back"]);
assert.deepEqual(mappedExercise.secondaryMuscles, ["Biceps"]);
assert.equal(mappedExercise.description, "row description");
assert.equal(mappedExercise.exerciseImageUrl, "system-image.png");
assert.equal(mappedExercise.muscleWorkImageKey, "system-muscles");
assert.equal(mappedExercise.muscleWorkImageUrl, "system-muscles.png");
assert.equal(mappedExercise.note, "row note");
assert.equal(mappedExercise.sets[0].supabaseId, "set-a");
assert.equal(mappedExercise.sets[1].supabaseId, "set-b");

const mappedWorkout = mapSupabaseWorkout({
  id: "workout-server-2",
  client_workout_id: "client-workout-2",
  workout_date: "2026-06-30",
  title: "Loaded Pull",
  workout_type: "strength",
  status: "started",
  duration_seconds: 1800,
  total_sets: 2,
  total_volume: 960,
  estimated_calories_burned: 225,
  created_at: "2026-06-30T18:00:00+00:00",
  notes: "loaded workout",
  user_program_id: "program-2",
  program_name: "Loaded Program",
  is_program_generated: true,
  workout_exercises: [{
    id: "exercise-server-3",
    exercise_name: "Free Row",
    exercise_order: 1,
    workout_sets: [{ id: "set-server-3", set_order: 1, weight_kg: 60, reps: 8 }]
  }]
}, 0, readMapperOptions);

assert.equal(mappedWorkout.id, "workout-supabase-workout-server-2");
assert.equal(mappedWorkout.supabaseId, "workout-server-2");
assert.equal(mappedWorkout.clientWorkoutId, "client-workout-2");
assert.equal(mappedWorkout.date, "2026-06-30");
assert.equal(mappedWorkout.weekday, "Вторник");
assert.equal(mappedWorkout.title, "Loaded Pull");
assert.equal(mappedWorkout.status, "active");
assert.equal(mappedWorkout.startedAt, "2026-06-30T18:00:00+00:00");
assert.equal(mappedWorkout.durationMinutes, 30);
assert.equal(mappedWorkout.totalVolumeKg, 960);
assert.equal(mappedWorkout.serverTotalSets, 2);
assert.equal(mappedWorkout.serverTotalVolume, 960);
assert.equal(mappedWorkout.calories, 225);
assert.equal(mappedWorkout.notes, "loaded workout");
assert.equal(mappedWorkout.userProgramId, "program-2");
assert.equal(mappedWorkout.programName, "Loaded Program");
assert.equal(mappedWorkout.isProgramGenerated, true);
assert.equal(mappedWorkout.exercises.length, 1);

const nestedTree = buildWorkoutTreeFromApi({
  workouts: [{
    id: "workout-nested-1",
    workout_date: "2026-06-30",
    workout_exercises: [{
      id: "exercise-nested-1",
      exercise_name: "Lat Pulldown",
      workout_sets: [{ id: "set-nested-1", set_order: 1, weight_kg: 40, reps: 12 }]
    }]
  }]
}, readMapperOptions);
assert.equal(nestedTree.length, 1);
assert.equal(nestedTree[0].exercises[0].sets[0].supabaseId, "set-nested-1");

const flatTree = buildWorkoutTreeFromApi({
  workouts: [{ id: "workout-flat-1", workout_date: "2026-06-30" }],
  workout_exercises: [{ id: "exercise-flat-1", workout_id: "workout-flat-1", exercise_name: "Lat Pulldown" }],
  workout_sets: [{ id: "set-flat-1", workout_exercise_id: "exercise-flat-1", set_order: 1, weight_kg: 30, reps: 15 }]
}, readMapperOptions);
assert.equal(flatTree.length, 1);
assert.equal(flatTree[0].exercises.length, 1);
assert.equal(flatTree[0].exercises[0].sets.length, 1);
assert.equal(flatTree[0].exercises[0].sets[0].supabaseId, "set-flat-1");

console.log("workout mapper checks passed");
