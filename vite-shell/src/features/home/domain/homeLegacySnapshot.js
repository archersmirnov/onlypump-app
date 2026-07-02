import {
  DEFAULT_HOME_WIDGETS,
  HOME_LAYOUT_MOBILE,
  buildHomeWidgetsViewModel,
  homeWidgetsForLayout,
} from "./homeWidgets.js";

function firstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeDateKey(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function pickLatestDatedRecord(records = [], selectedDateKey = "") {
  if (!Array.isArray(records) || !records.length) return {};

  const selectedKey = normalizeDateKey(selectedDateKey);
  const datedRecords = records
    .filter((record) => record && typeof record === "object")
    .map((record) => ({
      record,
      dateKey: normalizeDateKey(
        record.date ||
          record.log_date ||
          record.measurement_date ||
          record.recorded_at ||
          record.created_at
      ),
    }))
    .filter((item) => item.dateKey);

  if (!datedRecords.length) return objectOrEmpty(records[records.length - 1]);

  const matchingRecords = selectedKey
    ? datedRecords.filter((item) => item.dateKey <= selectedKey)
    : datedRecords;

  const sorted = (matchingRecords.length ? matchingRecords : datedRecords)
    .slice()
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return objectOrEmpty(sorted[0]?.record);
}

function selectHomeWidgets(snapshot = {}, profile = {}, options = {}) {
  const layoutMode = options.layoutMode || snapshot.layoutMode || HOME_LAYOUT_MOBILE;
  return homeWidgetsForLayout(
    options.widgets ||
      snapshot.widgets ||
      snapshot.homeWidgets ||
      snapshot.home_widgets_order ||
      profile.home_widgets_order,
    layoutMode,
    DEFAULT_HOME_WIDGETS
  );
}

export function buildHomeWidgetsSourceFromLegacySnapshot(snapshot = {}, options = {}) {
  const profile = objectOrEmpty(snapshot.profile);
  const selectedDateKey = normalizeDateKey(
    firstDefined(
      options.selectedDateKey,
      snapshot.selectedDateKey,
      snapshot.globalSelectedDateKey,
      snapshot.dateKey,
      snapshot.selectedDate,
      snapshot.currentDate
    )
  );

  const latestMeasurement = pickLatestDatedRecord(
    snapshot.measurementRecords || snapshot.measurementsHistory || snapshot.bodyMeasurements,
    selectedDateKey
  );
  const measurement = {
    ...latestMeasurement,
    ...objectOrEmpty(snapshot.measurement),
    ...objectOrEmpty(snapshot.measurements),
  };
  const workoutSummary = objectOrEmpty(
    snapshot.workoutSummary || snapshot.weekSummary || snapshot.trainingSummary
  );
  const training = objectOrEmpty(snapshot.training);
  const nutritionDay = objectOrEmpty(snapshot.nutritionDay);
  const nutritionTotals = objectOrEmpty(
    snapshot.nutritionTotals ||
      snapshot.selectedNutritionTotals ||
      nutritionDay.totals ||
      snapshot.nutritionSummary?.totals
  );
  const healthLog = objectOrEmpty(snapshot.healthLog || snapshot.health || snapshot.healthSummary);

  return {
    selectedDateKey,
    widgets: selectHomeWidgets(snapshot, profile, options),
    profile,
    measurement: {
      weight: firstDefined(
        measurement.weight,
        measurement.weight_kg,
        measurement.weightKg,
        profile.weight,
        profile.weight_kg,
        profile.weightKg
      ),
      weight_kg: firstDefined(measurement.weight_kg, measurement.weight, profile.weight_kg),
      bodyFat: firstDefined(
        measurement.bodyFat,
        measurement.body_fat_percent,
        measurement.bodyFatPercent,
        profile.bodyFat,
        profile.body_fat_percent
      ),
      body_fat_percent: firstDefined(
        measurement.body_fat_percent,
        measurement.bodyFat,
        measurement.bodyFatPercent,
        profile.body_fat_percent
      ),
    },
    training: {
      totalVolume: firstDefined(
        training.totalVolume,
        training.total_volume,
        workoutSummary.totalVolume,
        workoutSummary.total_volume,
        workoutSummary.completedVolume,
        workoutSummary.completed_volume,
        workoutSummary.weekVolume,
        workoutSummary.week_volume
      ),
      total_volume: firstDefined(
        training.total_volume,
        training.totalVolume,
        workoutSummary.total_volume,
        workoutSummary.totalVolume
      ),
      completedSets: firstDefined(
        training.completedSets,
        training.completed_sets,
        workoutSummary.completedSets,
        workoutSummary.completed_sets,
        workoutSummary.totalSets,
        workoutSummary.total_sets
      ),
      totalSets: firstDefined(training.totalSets, training.total_sets, workoutSummary.totalSets),
      total_sets: firstDefined(training.total_sets, training.totalSets, workoutSummary.total_sets),
    },
    nutrition: {
      calories: firstDefined(nutritionTotals.calories, nutritionTotals.calories_total),
      calories_total: firstDefined(nutritionTotals.calories_total, nutritionTotals.calories),
      protein: firstDefined(nutritionTotals.protein, nutritionTotals.protein_total),
      protein_total: firstDefined(nutritionTotals.protein_total, nutritionTotals.protein),
      totals: {
        calories: firstDefined(nutritionTotals.calories, nutritionTotals.calories_total),
        protein: firstDefined(nutritionTotals.protein, nutritionTotals.protein_total),
      },
    },
    health: {
      recoveryScore: firstDefined(healthLog.recoveryScore, healthLog.recovery_score),
      recovery_score: firstDefined(healthLog.recovery_score, healthLog.recoveryScore),
      sleepMinutes: firstDefined(
        healthLog.sleepMinutes,
        healthLog.sleep_minutes,
        healthLog.sleep_duration_minutes
      ),
      sleep_duration_minutes: firstDefined(
        healthLog.sleep_duration_minutes,
        healthLog.sleepMinutes,
        healthLog.sleep_minutes
      ),
      steps: firstDefined(healthLog.steps, healthLog.steps_count),
      steps_count: firstDefined(healthLog.steps_count, healthLog.steps),
    },
  };
}

export function buildHomeWidgetsViewModelFromLegacySnapshot(snapshot = {}, options = {}) {
  const source = buildHomeWidgetsSourceFromLegacySnapshot(snapshot, options);
  return buildHomeWidgetsViewModel(source, { widgets: source.widgets });
}
