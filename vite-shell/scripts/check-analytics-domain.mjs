import assert from "node:assert/strict";
import {
  analyticsChartDaysBetween,
  analyticsSummary,
  buildHealthSeries,
  buildMeasurementSeries,
  buildNutritionSeries,
  buildTrainingSeries,
  buildWorkoutWeekRange,
  filterRollingAnalyticsPoints,
  formatAnalyticsDateKey,
  getActualWorkoutStats,
  getAnalyticsChartRollingRange,
  getAnalyticsPeriodRange,
  getExpectedWorkoutStats,
  getPlannedWorkoutStats,
  getWorkoutVolume,
  isLongAnalyticsChartPeriod,
  nutritionMetricValue,
  parseAnalyticsDateKeyLocal,
  shiftAnalyticsChartDivisionDate,
  shiftAnalyticsPeriodDate,
  summarizeCurrentWeekWorkouts
} from "../src/features/analytics/domain/index.js";

assert.equal(formatAnalyticsDateKey(parseAnalyticsDateKeyLocal("2026-07-01")), "2026-07-01");
assert.deepEqual(getAnalyticsPeriodRange("month", "2026-07-15"), {
  startKey: "2026-07-01",
  endKey: "2026-07-31",
  label: "июль 2026 г."
});
assert.deepEqual(getAnalyticsPeriodRange("year", "2026-07-15"), {
  startKey: "2026-01-01",
  endKey: "2026-12-31",
  label: "2026"
});
assert.equal(getAnalyticsPeriodRange("week", "2026-01-08").weekIndex, 2);
assert.equal(shiftAnalyticsPeriodDate("2026-07-15", "month", 1), "2026-08-01");
assert.equal(shiftAnalyticsPeriodDate("2026-07-15", "week", -1), "2026-07-08");
assert.equal(shiftAnalyticsChartDivisionDate("2026-03-31", "year", 1), "2026-04-30");
assert.equal(shiftAnalyticsChartDivisionDate("2026-07-15", "sixMonths", -1), "2026-07-08");
assert.equal(isLongAnalyticsChartPeriod("six_months"), true);
assert.equal(isLongAnalyticsChartPeriod("month"), false);

assert.deepEqual(getAnalyticsChartRollingRange("sixMonths", "2026-07-01"), {
  startKey: "2025-12-31",
  endKey: "2026-07-01"
});
assert.deepEqual(getAnalyticsChartRollingRange("year", "2026-07-15"), {
  startKey: "2025-08-01",
  endKey: "2026-07-15"
});
assert.equal(analyticsChartDaysBetween("2026-07-01", "2026-07-08"), 7);

const points = [
  { date: "2026-06-29", value: 10 },
  { date: "2026-07-01", value: 20 },
  { date: "2026-07-02", value: 30 },
  { date: "2026-08-01", value: 40 }
];
assert.deepEqual(filterRollingAnalyticsPoints(points, "week", "2026-07-02").map((point) => point.date), [
  "2026-06-29",
  "2026-07-01",
  "2026-07-02"
]);
assert.deepEqual(analyticsSummary(points), {
  avg: 25,
  min: 10,
  max: 40,
  change: 30,
  trend: "рост"
});
assert.equal(analyticsSummary([{ value: 5 }, { value: 3 }]).trend, "снижение");
assert.equal(analyticsSummary([]).trend, "нет данных");

assert.deepEqual(buildMeasurementSeries([
  { measurement_date: "2026-07-02", weight_kg: 82 },
  { date: "2026-07-01", weight_kg: 81 },
  { date: "2026-07-03", weight_kg: 0 }
], "weight_kg"), [
  { date: "2026-07-01", value: 81 },
  { date: "2026-07-02", value: 82 }
]);

assert.deepEqual(buildHealthSeries([
  { log_date: "2026-07-01", steps_count: 9000 },
  { date: "2026-07-02", steps_count: 0 },
  { date: "2026-07-03", steps_count: 11000 }
], "steps_count"), [
  { date: "2026-07-01", value: 9000 },
  { date: "2026-07-03", value: 11000 }
]);

assert.equal(nutritionMetricValue({ totals: { calories: 2500, protein: 160, fat: 70, carbs: 280 } }, "protein_total"), 160);
assert.equal(nutritionMetricValue({ manual_palm_units: { protein: 2, fat: 1, carbs: 3, vegetables: 2 } }, "palms_total"), 8);
assert.deepEqual(buildNutritionSeries([
  { nutrition_date: "2026-07-02", totals: { calories: 2100 } },
  { date: "2026-07-01", calories_total: 2000 },
  { date: "2026-07-03", calories_total: 0 }
]), [
  { date: "2026-07-01", value: 2000 },
  { date: "2026-07-02", value: 2100 }
]);

const strengthExercise = {
  exerciseCategory: "strength",
  measurementMode: "weight_reps",
  sets: [
    { id: "set-1", weight: 100, reps: 10, status: "completed" },
    { id: "set-2", weight: 110, reps: 8, status: "pending" }
  ]
};
const doubleExercise = {
  exerciseCategory: "strength",
  measurementMode: "weight_reps",
  doubleCountInStatistics: true,
  sets: [{ id: "set-3", weight: 20, reps: 10, status: "completed" }]
};
const cardioExercise = {
  exerciseCategory: "cardio",
  measurementMode: "time",
  sets: [{ id: "set-4", weight: 999, reps: 999, status: "completed" }]
};
const workouts = [
  {
    id: "completed-1",
    date: "2026-07-01",
    status: "completed",
    workoutType: "strength",
    exercises: [strengthExercise, doubleExercise]
  },
  {
    id: "planned-1",
    date: "2026-07-03",
    status: "planned",
    exercises: [{ ...strengthExercise, sets: [{ id: "set-5", weight: 60, reps: 10, status: "pending" }] }]
  },
  {
    id: "active-1",
    date: "2026-07-04",
    status: "active",
    exercises: [{ ...strengthExercise, sets: [{ id: "set-6", weight: 70, reps: 10, status: "pending" }] }]
  },
  {
    id: "outside-week",
    date: "2026-07-10",
    status: "planned",
    exercises: [strengthExercise]
  },
  {
    id: "cardio-1",
    date: "2026-07-02",
    status: "completed",
    workoutType: "cardio",
    exercises: [cardioExercise]
  }
];
const weekRange = buildWorkoutWeekRange("2026-07-01");
assert.equal(weekRange.startKey, "2026-06-29");
assert.equal(weekRange.endKey, "2026-07-05");
assert.equal(getWorkoutVolume(workouts[0]), 1400);
assert.equal(getWorkoutVolume(workouts[0], false), 2280);
assert.equal(getActualWorkoutStats(workouts, weekRange).setCount, 3);
assert.equal(getActualWorkoutStats(workouts, weekRange).volume, 1400);
assert.equal(getPlannedWorkoutStats(workouts, weekRange).setCount, 6);
assert.equal(getPlannedWorkoutStats(workouts, weekRange).volume, 3580);
assert.equal(getExpectedWorkoutStats(workouts, weekRange).setCount, 5);
assert.equal(getExpectedWorkoutStats(workouts, weekRange).volume, 2700);
assert.deepEqual(summarizeCurrentWeekWorkouts(workouts, "2026-07-01"), {
  range: weekRange,
  completedSets: 3,
  totalSets: 6,
  plannedSets: 6,
  completedVolume: 1400,
  plannedVolume: 3580,
  progress: 50,
  exerciseCount: 5
});
assert.deepEqual(buildTrainingSeries(workouts, "sets"), [
  { date: "2026-07-01", value: 2 },
  { date: "2026-07-02", value: 1 }
]);
assert.deepEqual(buildTrainingSeries(workouts, "volume"), [
  { date: "2026-07-01", value: 1400 },
  { date: "2026-07-02", value: 0 }
]);

console.log("analytics domain checks passed");
