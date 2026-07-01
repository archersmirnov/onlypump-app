import {
  normalizeWorkoutStatus,
  normalizeWorkoutType,
  getSetStatus
} from "../../workouts/domain/index.js";
import {
  normalizeManualPalmUnits,
  roundNutritionMacro
} from "../../nutrition/domain/index.js";
import {
  getHealthLogDateKey,
  getMeasurementDateKey,
  healthLogHasRealData,
  measurementRecordHasRealData
} from "../../profile/domain/index.js";

export const ANALYTICS_PERIODS = Object.freeze({
  day: "day",
  week: "week",
  month: "month",
  sixMonths: "sixMonths",
  year: "year"
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WORKOUT_PLAN_STATUSES = new Set(["planned", "active", "completed"]);
const WORKOUT_ACTUAL_STATUSES = new Set(["completed"]);

export function parseAnalyticsDateKeyLocal(dateKey, fallback = new Date()) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (year && month && day) return new Date(year, month - 1, day);
  const parsed = new Date(dateKey);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return fallback instanceof Date ? fallback : new Date(fallback);
}

export function formatAnalyticsDateKey(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeAnalyticsDateKey(value, fallback = "") {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatAnalyticsDateKey(value);
  return fallback;
}

export function addAnalyticsDays(date, days) {
  const source = date instanceof Date ? date : parseAnalyticsDateKeyLocal(date);
  const next = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

export function dateKeyDaysAgo(dateKey, days) {
  return formatAnalyticsDateKey(addAnalyticsDays(parseAnalyticsDateKeyLocal(dateKey), -Number(days || 0)));
}

export function startOfAnalyticsWeekMonday(date = new Date()) {
  const safeDate = date instanceof Date ? date : parseAnalyticsDateKeyLocal(date);
  const start = new Date(safeDate.getFullYear(), safeDate.getMonth(), safeDate.getDate());
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
}

export function normalizeAnalyticsPeriod(period = ANALYTICS_PERIODS.month) {
  const value = String(period || "").trim();
  if (["sixMonths", "six_months", "6months", "halfYear", "half_year"].includes(value)) return ANALYTICS_PERIODS.sixMonths;
  return Object.values(ANALYTICS_PERIODS).includes(value) ? value : ANALYTICS_PERIODS.month;
}

export function getAnalyticsPeriodRange(period = ANALYTICS_PERIODS.day, selectedDateKey = formatAnalyticsDateKey(new Date())) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const selected = parseAnalyticsDateKeyLocal(selectedDateKey);

  if (normalizedPeriod === ANALYTICS_PERIODS.year) {
    return {
      startKey: formatAnalyticsDateKey(new Date(selected.getFullYear(), 0, 1)),
      endKey: formatAnalyticsDateKey(new Date(selected.getFullYear(), 11, 31)),
      label: String(selected.getFullYear())
    };
  }

  if (normalizedPeriod === ANALYTICS_PERIODS.month) {
    return {
      startKey: formatAnalyticsDateKey(new Date(selected.getFullYear(), selected.getMonth(), 1)),
      endKey: formatAnalyticsDateKey(new Date(selected.getFullYear(), selected.getMonth() + 1, 0)),
      label: selected.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    };
  }

  if (normalizedPeriod === ANALYTICS_PERIODS.week) {
    const yearStart = new Date(selected.getFullYear(), 0, 1);
    const weekIndex = Math.max(1, Math.floor((selected - yearStart) / (7 * MS_PER_DAY)) + 1);
    const start = addAnalyticsDays(yearStart, (weekIndex - 1) * 7);
    const end = addAnalyticsDays(start, 6);
    return {
      startKey: formatAnalyticsDateKey(start),
      endKey: formatAnalyticsDateKey(end),
      label: `Неделя ${weekIndex}, ${selected.getFullYear()}`,
      weekIndex
    };
  }

  return {
    startKey: formatAnalyticsDateKey(selected),
    endKey: formatAnalyticsDateKey(selected),
    label: selected.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
  };
}

export function isAnalyticsDateInRange(dateKey, range = null) {
  if (!range) return true;
  const value = normalizeAnalyticsDateKey(dateKey, "");
  return Boolean(value && value >= range.startKey && value <= range.endKey);
}

export function shiftAnalyticsPeriodDate(selectedDateKey, period = ANALYTICS_PERIODS.day, amount = 1) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const date = parseAnalyticsDateKeyLocal(selectedDateKey);
  if (normalizedPeriod === ANALYTICS_PERIODS.year) return formatAnalyticsDateKey(new Date(date.getFullYear() + amount, 0, 1));
  if (normalizedPeriod === ANALYTICS_PERIODS.month) return formatAnalyticsDateKey(new Date(date.getFullYear(), date.getMonth() + amount, 1));
  if (normalizedPeriod === ANALYTICS_PERIODS.week) return formatAnalyticsDateKey(addAnalyticsDays(date, amount * 7));
  return formatAnalyticsDateKey(addAnalyticsDays(date, amount));
}

export function getAnalyticsChartPeriodSpanDays(period = ANALYTICS_PERIODS.month) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  if (normalizedPeriod === ANALYTICS_PERIODS.day) return 1;
  if (normalizedPeriod === ANALYTICS_PERIODS.week) return 7;
  if (normalizedPeriod === ANALYTICS_PERIODS.month) return 30;
  if (normalizedPeriod === ANALYTICS_PERIODS.sixMonths) return 183;
  if (normalizedPeriod === ANALYTICS_PERIODS.year) return 365;
  return 30;
}

export function getAnalyticsChartRollingRange(period = ANALYTICS_PERIODS.month, selectedDateKey = formatAnalyticsDateKey(new Date())) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  if (normalizedPeriod === ANALYTICS_PERIODS.year) {
    const selected = parseAnalyticsDateKeyLocal(selectedDateKey);
    const start = new Date(selected.getFullYear(), selected.getMonth() - 11, 1);
    return {
      startKey: formatAnalyticsDateKey(start),
      endKey: normalizeAnalyticsDateKey(selectedDateKey, formatAnalyticsDateKey(selected))
    };
  }

  if (normalizedPeriod === ANALYTICS_PERIODS.month) return getAnalyticsPeriodRange(ANALYTICS_PERIODS.month, selectedDateKey);

  const days = getAnalyticsChartPeriodSpanDays(normalizedPeriod);
  return {
    startKey: dateKeyDaysAgo(selectedDateKey, days - 1),
    endKey: normalizeAnalyticsDateKey(selectedDateKey, formatAnalyticsDateKey(new Date()))
  };
}

export function analyticsChartDaysBetween(startKey, endKey) {
  const start = parseAnalyticsDateKeyLocal(startKey).getTime();
  const end = parseAnalyticsDateKeyLocal(endKey).getTime();
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}

export function filterAnalyticsPoints(points = [], period = ANALYTICS_PERIODS.month, selectedDateKey = formatAnalyticsDateKey(new Date())) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const range = [ANALYTICS_PERIODS.day, ANALYTICS_PERIODS.week, ANALYTICS_PERIODS.month, ANALYTICS_PERIODS.year].includes(normalizedPeriod)
    ? getAnalyticsPeriodRange(normalizedPeriod, selectedDateKey)
    : getAnalyticsChartRollingRange(normalizedPeriod, selectedDateKey);
  return sortAnalyticsPoints(points.filter((point) => isAnalyticsDateInRange(point.date, range)));
}

export function filterRollingAnalyticsPoints(points = [], period = ANALYTICS_PERIODS.month, selectedDateKey = formatAnalyticsDateKey(new Date())) {
  const range = getAnalyticsChartRollingRange(period, selectedDateKey);
  return sortAnalyticsPoints(points.filter((point) => isAnalyticsDateInRange(point.date, range)));
}

export function shiftAnalyticsChartDivisionDate(selectedDateKey, period = ANALYTICS_PERIODS.month, amount = 1) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const date = parseAnalyticsDateKeyLocal(selectedDateKey);
  if (normalizedPeriod === ANALYTICS_PERIODS.sixMonths) return formatAnalyticsDateKey(addAnalyticsDays(date, amount * 7));
  if (normalizedPeriod === ANALYTICS_PERIODS.year) {
    const targetMonth = new Date(date.getFullYear(), date.getMonth() + amount, 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    return formatAnalyticsDateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(date.getDate(), lastDay)));
  }
  return formatAnalyticsDateKey(addAnalyticsDays(date, amount));
}

export function isLongAnalyticsChartPeriod(period = ANALYTICS_PERIODS.month) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  return normalizedPeriod === ANALYTICS_PERIODS.sixMonths || normalizedPeriod === ANALYTICS_PERIODS.year;
}

export function getAnalyticsChartSvgWidth(period = ANALYTICS_PERIODS.month) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  if (normalizedPeriod === ANALYTICS_PERIODS.year) return 720;
  if (normalizedPeriod === ANALYTICS_PERIODS.sixMonths) return 560;
  return 430;
}

export function analyticsSummary(points = []) {
  const values = (Array.isArray(points) ? points : [])
    .map((point) => Number(point?.value))
    .filter(Number.isFinite);
  if (!values.length) return { avg: 0, min: 0, max: 0, change: 0, trend: "нет данных" };
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const change = values[values.length - 1] - values[0];
  return {
    avg,
    min: Math.min(...values),
    max: Math.max(...values),
    change,
    trend: change > 0 ? "рост" : change < 0 ? "снижение" : "ровно"
  };
}

export function sortAnalyticsPoints(points = []) {
  return (Array.isArray(points) ? points : [])
    .filter((point) => normalizeAnalyticsDateKey(point?.date, ""))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function buildMetricSeries(rows = [], {
  dateKeys = ["date"],
  metricKey = "value",
  valueGetter = null
} = {}) {
  return sortAnalyticsPoints((Array.isArray(rows) ? rows : [])
    .map((row) => {
      const date = dateKeys.reduce((found, key) => found || normalizeAnalyticsDateKey(row?.[key], ""), "");
      const value = typeof valueGetter === "function" ? valueGetter(row) : Number(row?.[metricKey]);
      return { date, value: Number(value) };
    })
    .filter((point) => point.date && Number.isFinite(point.value) && point.value > 0));
}

export function buildMeasurementSeries(measurements = [], metricKey = "weight_kg") {
  return buildMetricSeries(measurements, {
    dateKeys: ["measurement_date", "date"],
    metricKey
  });
}

export function buildHealthSeries(logs = [], metricKey = "steps_count") {
  return buildMetricSeries(logs, {
    dateKeys: ["log_date", "date"],
    metricKey
  });
}

export function getNutritionTotalsForAnalytics(day = {}) {
  const totals = day?.totals || {};
  return {
    calories: Number(totals.calories ?? day.calories_total ?? day.caloriesTotal ?? day.calories ?? 0),
    protein: Number(totals.protein ?? day.protein_total ?? day.proteinTotal ?? day.protein ?? 0),
    fat: Number(totals.fat ?? day.fat_total ?? day.fatTotal ?? day.fat ?? 0),
    carbs: Number(totals.carbs ?? day.carbs_total ?? day.carbsTotal ?? day.carbs ?? 0),
    fiber: Number(totals.fiber ?? day.fiber_total ?? day.fiberTotal ?? day.fiber ?? 0)
  };
}

export function nutritionPalmValueFromDay(day = {}) {
  const manual = normalizeManualPalmUnits(day.manual_palm_units || day.manualPalmUnits);
  const manualTotal = manual.protein + manual.fat + manual.carbs + manual.vegetables;
  if (manualTotal > 0) return roundNutritionMacro(manualTotal);
  const totals = getNutritionTotalsForAnalytics(day);
  return roundNutritionMacro((totals.protein / 28) + (totals.fat / 12) + (totals.carbs / 35));
}

export function nutritionMetricValue(day = {}, metricKey = "calories_total") {
  if (metricKey === "palms_total") return nutritionPalmValueFromDay(day);
  const totals = getNutritionTotalsForAnalytics(day);
  if (metricKey === "protein_total") return Number(totals.protein || 0);
  if (metricKey === "fat_total") return Number(totals.fat || 0);
  if (metricKey === "carbs_total") return Number(totals.carbs || 0);
  if (metricKey === "fiber_total") return Number(totals.fiber || 0);
  return Number(totals.calories || 0);
}

export function buildNutritionSeries(days = [], metricKey = "calories_total") {
  return buildMetricSeries(days, {
    dateKeys: ["nutrition_date", "date"],
    valueGetter: (day) => nutritionMetricValue(day, metricKey)
  });
}

export function getAnalyticsHealthRows(source = {}, range = null) {
  const rows = Array.isArray(source) ? source : [source.healthLog, ...(Array.isArray(source.healthLogs) ? source.healthLogs : [])];
  return rows
    .filter(Boolean)
    .filter((log) => {
      const key = getHealthLogDateKey(log);
      return key && isAnalyticsDateInRange(key, range) && healthLogHasRealData(log);
    })
    .sort((a, b) => getHealthLogDateKey(a).localeCompare(getHealthLogDateKey(b)));
}

export function getAnalyticsMeasurementRows(rows = [], range = null) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const key = getMeasurementDateKey(row);
      return key && isAnalyticsDateInRange(key, range) && measurementRecordHasRealData(row);
    })
    .sort((a, b) => getMeasurementDateKey(a).localeCompare(getMeasurementDateKey(b)));
}

export function getWorkoutDateKey(workout = {}) {
  return normalizeAnalyticsDateKey(workout.date || workout.workout_date || workout.scheduled_date, "");
}

export function getWorkoutSets(workout = {}) {
  return (workout?.exercises || []).flatMap((exercise) =>
    (exercise.sets || []).map((set) => ({ ...set, __exercise: exercise }))
  );
}

export function getSetVolumeForAnalytics(set = {}, exercise = {}) {
  const category = String(exercise.exerciseCategory || exercise.exercise_category || exercise.category || "strength").toLowerCase();
  const measurementMode = String(exercise.measurementMode || exercise.measurement_mode || "weight_reps").toLowerCase();
  const countsInStats = exercise.countsInMuscleStats ?? exercise.counts_in_muscle_stats;
  const measureWeightEnabled = exercise.measureWeightEnabled ?? exercise.measure_weight_enabled;
  const measureRepsEnabled = exercise.measureRepsEnabled ?? exercise.measure_reps_enabled;
  if (countsInStats === false || category !== "strength") return 0;
  if (measureWeightEnabled === false || measureRepsEnabled === false) return 0;
  if (!["weight_reps", "reps", "weight_time", "weight_distance"].includes(measurementMode)) return 0;
  const weight = Number(set.weight ?? set.weight_kg ?? set.weight_value ?? 0);
  const reps = Number(set.reps ?? set.reps_value ?? 0);
  const baseVolume = (Number.isFinite(weight) ? weight : 0) * (Number.isFinite(reps) ? reps : 0);
  const doubleCount = Boolean(exercise.doubleCountInStatistics ?? exercise.double_count_in_statistics ?? exercise.doubleWeightInStats ?? exercise.double_weight_in_stats);
  return doubleCount ? baseVolume * 2 : baseVolume;
}

export function getWorkoutCompletedSets(workout = {}) {
  return getWorkoutSets(workout).filter((set) => getSetStatus(set) === "completed");
}

export function getWorkoutPlannedSets(workout = {}) {
  return getWorkoutSets(workout);
}

export function getWorkoutExpectedSets(workout = {}) {
  return normalizeWorkoutStatus(workout.status) === "completed"
    ? getWorkoutCompletedSets(workout)
    : getWorkoutPlannedSets(workout);
}

export function getWorkoutVolume(workout = {}, completedOnly = true) {
  const sets = completedOnly ? getWorkoutCompletedSets(workout) : getWorkoutSets(workout);
  return sets.reduce((sum, set) => sum + getSetVolumeForAnalytics(set, set.__exercise), 0);
}

export function buildWorkoutDateRangeFromStart(startDate = new Date(), days = 7) {
  const start = startDate instanceof Date ? startDate : parseAnalyticsDateKeyLocal(startDate);
  return {
    start,
    end: addAnalyticsDays(start, days),
    startKey: formatAnalyticsDateKey(start),
    endKey: formatAnalyticsDateKey(addAnalyticsDays(start, days - 1))
  };
}

export function buildWorkoutWeekRange(anchorDate = new Date()) {
  return buildWorkoutDateRangeFromStart(startOfAnalyticsWeekMonday(anchorDate), 7);
}

export function isWorkoutInDateRange(workout = {}, range = null) {
  if (!range) return true;
  const dateKey = getWorkoutDateKey(workout);
  if (!dateKey) return false;
  if (range.startKey || range.endKey) {
    const startKey = range.startKey || "0000-00-00";
    const endKey = range.endKey || "9999-99-99";
    return dateKey >= startKey && dateKey <= endKey;
  }
  const time = parseAnalyticsDateKeyLocal(dateKey).getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

export function filterWorkoutsByDateRange(items = [], range = null) {
  return (Array.isArray(items) ? items : []).filter((workout) => isWorkoutInDateRange(workout, range));
}

export function getActualWorkouts(items = [], range = null) {
  return filterWorkoutsByDateRange(items, range)
    .filter((workout) => WORKOUT_ACTUAL_STATUSES.has(normalizeWorkoutStatus(workout.status)));
}

export function getPlannedWorkouts(items = [], range = null) {
  return filterWorkoutsByDateRange(items, range)
    .filter((workout) => WORKOUT_PLAN_STATUSES.has(normalizeWorkoutStatus(workout.status)));
}

export function getExpectedWorkouts(items = [], range = null) {
  return getPlannedWorkouts(items, range)
    .filter((workout) => getWorkoutExpectedSets(workout).length > 0);
}

export function summarizeWorkoutSetList(workouts = [], getSets = getWorkoutPlannedSets) {
  const workoutList = Array.isArray(workouts) ? workouts : [];
  const sets = workoutList.flatMap((workout) => getSets(workout));
  return {
    workouts: workoutList,
    workoutsCount: workoutList.length,
    sets,
    setCount: sets.length,
    volume: sets.reduce((sum, set) => sum + getSetVolumeForAnalytics(set, set.__exercise), 0),
    exerciseCount: workoutList.reduce((sum, workout) => sum + (workout.exercises || []).length, 0)
  };
}

export function getActualWorkoutStats(items = [], range = null) {
  return summarizeWorkoutSetList(getActualWorkouts(items, range), getWorkoutCompletedSets);
}

export function getPlannedWorkoutStats(items = [], range = null) {
  return summarizeWorkoutSetList(getPlannedWorkouts(items, range), getWorkoutPlannedSets);
}

export function getExpectedWorkoutStats(items = [], range = null) {
  return summarizeWorkoutSetList(getExpectedWorkouts(items, range), getWorkoutExpectedSets);
}

export function summarizeWorkouts(items = []) {
  const plannedStats = summarizeWorkoutSetList(items, getWorkoutPlannedSets);
  const actualStats = summarizeWorkoutSetList(items, getWorkoutCompletedSets);
  const totalSets = plannedStats.setCount;
  return {
    completedSets: actualStats.setCount,
    totalSets,
    completedVolume: actualStats.volume,
    plannedVolume: plannedStats.volume,
    progress: totalSets ? Math.round((actualStats.setCount / totalSets) * 100) : 0,
    exerciseCount: plannedStats.exerciseCount
  };
}

export function summarizeCurrentWeekWorkouts(items = [], anchorDate = new Date()) {
  const range = buildWorkoutWeekRange(anchorDate);
  const plannedStats = getPlannedWorkoutStats(items, range);
  const actualStats = getActualWorkoutStats(items, range);
  const totalSets = plannedStats.setCount;
  return {
    range,
    completedSets: actualStats.setCount,
    totalSets,
    plannedSets: totalSets,
    completedVolume: actualStats.volume,
    plannedVolume: plannedStats.volume,
    progress: totalSets ? Math.round((actualStats.setCount / totalSets) * 100) : 0,
    exerciseCount: plannedStats.exerciseCount
  };
}

export function buildTrainingSeries(workouts = [], metricKey = "sets") {
  const byDate = new Map();
  getActualWorkouts(workouts).forEach((workout) => {
    const date = getWorkoutDateKey(workout);
    if (!date) return;
    const sets = getWorkoutCompletedSets(workout);
    const current = byDate.get(date) || { date, sets: 0, volume: 0, workouts: 0, cardio: 0 };
    current.sets += sets.length;
    current.volume += getWorkoutVolume(workout);
    current.workouts += 1;
    current.cardio += ["cardio", "hiit", "mobility"].includes(normalizeWorkoutType(workout.workoutType || workout.workout_type || workout.type)) ? 1 : 0;
    byDate.set(date, current);
  });
  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({ date: item.date, value: Number(item[metricKey] || 0) }));
}
