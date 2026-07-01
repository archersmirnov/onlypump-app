import {
  getExerciseCompletion,
  getFirstActiveSetId,
  getSetStatus,
  getWorkoutTypeMeta,
  normalizeWorkoutStatus,
  normalizeWorkoutSupersetMetadata
} from "./workoutNormalize.js";

export const WORKOUT_SCREEN_STATUS_LABELS = Object.freeze({
  planned: "Запланирована",
  active: "В процессе",
  completed: "Выполнена"
});

export const WORKOUT_SCREEN_DAY_LABELS = Object.freeze(["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"]);

function toWorkoutDate(value, fallback = new Date()) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  if (match) {
    const [year, month, day] = match[0].split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return fallback instanceof Date ? fallback : new Date(fallback);
}

export function formatWorkoutScreenDateKey(value = new Date()) {
  const date = toWorkoutDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addWorkoutScreenDays(dateKey, amount = 0) {
  const date = toWorkoutDate(dateKey);
  date.setDate(date.getDate() + Number(amount || 0));
  return formatWorkoutScreenDateKey(date);
}

export function getWorkoutScreenDateKey(workout = {}) {
  return formatWorkoutScreenDateKey(
    workout.date || workout.workout_date || workout.scheduled_date || workout.createdAt || workout.created_at
  );
}

export function buildWorkoutCalendarDays(selectedDateKey = formatWorkoutScreenDateKey(new Date()), visibleDays = 7) {
  const centerIndex = Math.floor(Number(visibleDays || 7) / 2);
  return Array.from({ length: Number(visibleDays || 7) }, (_, index) => {
    const dateKey = addWorkoutScreenDays(selectedDateKey, index - centerIndex);
    const date = toWorkoutDate(dateKey);
    return {
      dateKey,
      dayLabel: WORKOUT_SCREEN_DAY_LABELS[date.getDay()],
      dayNumber: date.getDate(),
      isSelected: dateKey === selectedDateKey
    };
  });
}

export function getWorkoutSetVolumeForScreen(set = {}) {
  const weight = Number(set.weight ?? set.weight_kg ?? set.weightValue ?? set.weight_value ?? 0);
  const reps = Number(set.reps ?? set.repsValue ?? set.reps_value ?? 0);
  return Math.max(0, Number.isFinite(weight) ? weight : 0) * Math.max(0, Number.isFinite(reps) ? reps : 0);
}

export function buildWorkoutSetRows(sets = []) {
  return (Array.isArray(sets) ? sets : [])
    .slice()
    .sort((a, b) => Number(a.order ?? a.set_order ?? 0) - Number(b.order ?? b.set_order ?? 0))
    .map((set, index) => {
      const status = getSetStatus(set);
      const weight = Number(set.weight ?? set.weight_kg ?? set.weightValue ?? set.weight_value ?? 0);
      const reps = Number(set.reps ?? set.repsValue ?? set.reps_value ?? 0);
      return {
        id: set.id || set.supabaseId || `set-${index + 1}`,
        order: Number(set.order ?? set.set_order ?? index + 1),
        status,
        isCompleted: status === "completed",
        weight,
        reps,
        rir: set.rir ?? null,
        rpe: set.rpe ?? null,
        volume: getWorkoutSetVolumeForScreen(set),
        label: `${Number.isFinite(weight) ? weight : 0} x ${Number.isFinite(reps) ? reps : 0}`
      };
    });
}

export function buildWorkoutExerciseRows(workout = {}) {
  const normalizedWorkout = normalizeWorkoutSupersetMetadata(workout);
  return (normalizedWorkout.exercises || [])
    .slice()
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((exercise, index) => {
      const completion = getExerciseCompletion(exercise);
      const setRows = buildWorkoutSetRows(exercise.sets);
      return {
        id: exercise.id || exercise.supabaseId || `exercise-${index + 1}`,
        order: Number(exercise.order ?? index + 1),
        name: exercise.name || exercise.exercise_name || "Упражнение",
        muscleGroup: exercise.muscleGroup || exercise.muscle_group || "Другое",
        isSuperset: Boolean(exercise.isSuperset),
        supersetOrder: exercise.supersetOrder || null,
        restSeconds: Number(exercise.restSeconds ?? exercise.rest_between_seconds ?? 0),
        activeSetId: getFirstActiveSetId(exercise),
        completion,
        setRows,
        totalVolume: setRows.reduce((sum, set) => sum + (set.isCompleted ? set.volume : 0), 0)
      };
    });
}

export function buildWorkoutCardModel(workout = {}) {
  const status = normalizeWorkoutStatus(workout.status);
  const typeMeta = getWorkoutTypeMeta(workout.workoutType || workout.workout_type || workout.type);
  const exerciseRows = buildWorkoutExerciseRows(workout);
  const setRows = exerciseRows.flatMap((exercise) => exercise.setRows);
  const completedSets = setRows.filter((set) => set.isCompleted);
  const totalSets = setRows.length;
  const totalVolume = setRows.reduce((sum, set) => sum + (set.isCompleted ? set.volume : 0), 0);

  return {
    id: workout.id || workout.supabaseId,
    supabaseId: workout.supabaseId || workout.id || null,
    dateKey: getWorkoutScreenDateKey(workout),
    title: workout.title || "Новая тренировка",
    status,
    statusLabel: WORKOUT_SCREEN_STATUS_LABELS[status] || WORKOUT_SCREEN_STATUS_LABELS.completed,
    type: typeMeta.id,
    typeLabel: typeMeta.shortLabel,
    typeColor: typeMeta.color,
    durationMinutes: Math.round(Number(workout.durationMinutes ?? workout.duration_minutes ?? 0)),
    exerciseRows,
    exerciseCount: exerciseRows.length,
    totalSets,
    completedSets: completedSets.length,
    totalVolume,
    progress: totalSets ? Math.round((completedSets.length / totalSets) * 100) : 0,
    hasSupabaseId: Boolean(workout.supabaseId || workout.id)
  };
}

export function groupWorkoutCardsByDate(workouts = []) {
  return (Array.isArray(workouts) ? workouts : []).reduce((map, workout) => {
    const card = buildWorkoutCardModel(workout);
    if (!map.has(card.dateKey)) map.set(card.dateKey, []);
    map.get(card.dateKey).push(card);
    return map;
  }, new Map());
}

export function buildWorkoutWeekSummary(workouts = [], selectedDateKey = formatWorkoutScreenDateKey(new Date())) {
  const startDateKey = addWorkoutScreenDays(selectedDateKey, -3);
  const endDateKey = addWorkoutScreenDays(selectedDateKey, 3);
  const cards = (Array.isArray(workouts) ? workouts : [])
    .map(buildWorkoutCardModel)
    .filter((card) => card.dateKey >= startDateKey && card.dateKey <= endDateKey);
  const plannedOrCompleted = cards.filter((card) => ["planned", "active", "completed"].includes(card.status));
  const completedCards = cards.filter((card) => card.status === "completed");
  const totalSets = plannedOrCompleted.reduce((sum, card) => sum + card.totalSets, 0);
  const completedSets = completedCards.reduce((sum, card) => sum + card.completedSets, 0);

  return {
    startDateKey,
    endDateKey,
    workoutsCount: plannedOrCompleted.length,
    completedWorkoutsCount: completedCards.length,
    totalSets,
    completedSets,
    totalVolume: completedCards.reduce((sum, card) => sum + card.totalVolume, 0),
    progress: totalSets ? Math.round((completedSets / totalSets) * 100) : 0
  };
}

export function buildWorkoutsScreenViewModel(workouts = [], options = {}) {
  const selectedDateKey = formatWorkoutScreenDateKey(options.selectedDateKey || new Date());
  const calendarDays = buildWorkoutCalendarDays(selectedDateKey, options.visibleDays || 7);
  const cardsByDate = groupWorkoutCardsByDate(workouts);
  const selectedWorkoutCards = cardsByDate.get(selectedDateKey) || [];

  return {
    selectedDateKey,
    calendarDays: calendarDays.map((day) => ({
      ...day,
      workoutsCount: (cardsByDate.get(day.dateKey) || []).length,
      hasWorkouts: (cardsByDate.get(day.dateKey) || []).length > 0
    })),
    selectedWorkoutCards,
    activeWorkout: selectedWorkoutCards.find((card) => card.status === "active") || null,
    weekSummary: buildWorkoutWeekSummary(workouts, selectedDateKey),
    totalWorkoutsCount: Array.isArray(workouts) ? workouts.length : 0
  };
}
