export const WORKOUT_STATUS = Object.freeze({
  planned: "planned",
  active: "active",
  completed: "completed"
});

export const WORKOUT_TYPE_DEFINITIONS = Object.freeze([
  { id: "strength", label: "Силовая", shortLabel: "Сила", title: "Силовая тренировка", color: "#ef4444", met: 3.8 },
  { id: "cardio", label: "Кардио", shortLabel: "Кардио", title: "Кардио", color: "#22c55e", met: 7.2 },
  { id: "yoga", label: "Йога", shortLabel: "Йога", title: "Йога", color: "#38bdf8", met: 3.0 },
  { id: "pilates", label: "Пилатес", shortLabel: "Пилатес", title: "Пилатес", color: "#a78bfa", met: 3.4 },
  { id: "stretching", label: "Растяжка", shortLabel: "Растяжка", title: "Растяжка", color: "#f59e0b", met: 2.4 }
]);

export const WORKOUT_TYPE_IDS = Object.freeze(WORKOUT_TYPE_DEFINITIONS.map((item) => item.id));
export const WORKOUT_TYPE_BY_ID = Object.freeze(
  Object.fromEntries(WORKOUT_TYPE_DEFINITIONS.map((item) => [item.id, item]))
);

export function normalizeWorkoutStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["planned", "scheduled", "plan"].includes(value)) return WORKOUT_STATUS.planned;
  if (["active", "started", "in_progress", "in-progress"].includes(value)) return WORKOUT_STATUS.active;
  return WORKOUT_STATUS.completed;
}

export function normalizeWorkoutType(value) {
  const normalized = String(value || "strength").trim().toLowerCase();
  return WORKOUT_TYPE_IDS.includes(normalized) ? normalized : "strength";
}

export function getWorkoutTypeMeta(value) {
  return WORKOUT_TYPE_BY_ID[normalizeWorkoutType(value)] || WORKOUT_TYPE_BY_ID.strength;
}

export function getSetStatus(set) {
  return set?.status || (set?.isCompleted ? "completed" : "pending");
}

export function isWorkingSet(set) {
  return (set?.type || "working") !== "warmup";
}

export function isCompletedSet(set) {
  return getSetStatus(set) === "completed";
}

export function getCompletedSetsFromWorkout(workout = {}) {
  return (workout?.exercises || [])
    .flatMap((exercise) => (exercise.sets || []).map((set) => ({ ...set, __exercise: exercise })))
    .filter(isCompletedSet);
}

export function getExerciseCompletion(exercise = {}) {
  const workingSets = (exercise?.sets || []).filter(isWorkingSet);
  const completedSets = workingSets.filter(isCompletedSet);
  return {
    total: workingSets.length,
    completed: completedSets.length,
    done: workingSets.length > 0 && completedSets.length === workingSets.length,
    partial: completedSets.length > 0 && completedSets.length < workingSets.length
  };
}

export function getFirstActiveSetId(exercise = {}) {
  const sets = exercise?.sets || [];
  return (sets.find((set) => getSetStatus(set) === "pending") || sets[0] || null)?.id || null;
}
