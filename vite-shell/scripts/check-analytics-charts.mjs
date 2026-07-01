import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAnalyticsChartCard,
  buildAnalyticsChartsViewModel,
  buildAnalyticsChartCoordinates,
  buildAnalyticsChartLabels,
  buildAnalyticsChartPath,
  formatAnalyticsChartDateLabel,
  formatAnalyticsChartValue
} from "../src/features/analytics/domain/index.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const analyticsIndexSource = await readFile(new URL("../src/features/analytics/index.js", import.meta.url), "utf8");
const analyticsDomainIndexSource = await readFile(new URL("../src/features/analytics/domain/index.js", import.meta.url), "utf8");
const previewSource = await readFile(new URL("../src/features/analytics/ui/AnalyticsChartsPreview.jsx", import.meta.url), "utf8");

assert.equal(formatAnalyticsChartValue(84.25, "кг"), "84.3 кг");
assert.equal(formatAnalyticsChartDateLabel("2026-07-01", "year"), "июл");
assert.equal(formatAnalyticsChartDateLabel("2026-07-01", "month"), "01.07");

const coordinates = buildAnalyticsChartCoordinates([
  { date: "2026-07-01", value: 80 },
  { date: "2026-07-02", value: 82 }
], 430, 160);
assert.equal(coordinates.length, 2);
assert.equal(coordinates[0].x, 34);
assert.equal(coordinates[1].x, 414);
assert.match(buildAnalyticsChartPath(coordinates), /^M 34 /);

const monthLabels = buildAnalyticsChartLabels([
  { date: "2026-07-01", value: 80 },
  { date: "2026-07-02", value: 82 }
], "month");
assert.deepEqual(monthLabels.map((label) => label.label), ["01.07", "02.07"]);

const yearLabels = buildAnalyticsChartLabels([
  { date: "2026-01-01", value: 80 },
  { date: "2026-01-15", value: 81 },
  { date: "2026-02-01", value: 82 }
], "year");
assert.deepEqual(yearLabels.map((label) => label.label), ["янв", "фев"]);

const source = {
  measurements: [
    { measurement_date: "2026-01-01", weight_kg: 84 },
    { measurement_date: "2026-02-01", weight_kg: 83 },
    { measurement_date: "2026-07-01", weight_kg: 80 }
  ],
  healthLogs: [
    { log_date: "2026-07-01", steps_count: 9000 }
  ],
  nutritionDays: [
    { date: "2026-07-01", totals: { calories: 2400 } }
  ],
  workouts: [
    {
      date: "2026-07-01",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 100, reps: 10, status: "completed" }] }]
    }
  ]
};

const weightCard = buildAnalyticsChartCard({
  key: "weight",
  title: "Вес",
  source: "measurements",
  metricKey: "weight_kg",
  unit: "кг",
  tone: "red"
}, source, { period: "year", selectedDateKey: "2026-07-01" });

assert.equal(weightCard.width, 720);
assert.equal(weightCard.isLongPeriod, true);
assert.equal(weightCard.chartPoints.length, 3);
assert.equal(weightCard.hasData, true);
assert.equal(weightCard.stats.trend, "снижение");
assert.ok(weightCard.path.startsWith("M "));
assert.equal(weightCard.labels.length, 3);

const model = buildAnalyticsChartsViewModel(source, { period: "year", selectedDateKey: "2026-07-01" });
assert.equal(model.period, "year");
assert.equal(model.isWideLayout, true);
assert.equal(model.charts.length, 4);
assert.equal(model.chartsWithData, 4);
assert.equal(model.charts.find((chart) => chart.key === "trainingVolume").stats.avgLabel, "1000 кг");

const monthModel = buildAnalyticsChartsViewModel(source, { period: "month", selectedDateKey: "2026-07-01" });
assert.equal(monthModel.isWideLayout, false);

assert.match(analyticsDomainIndexSource, /analyticsChartModel\.js/);
assert.doesNotMatch(analyticsIndexSource, /ui\/index\.js/);
assert.match(previewSource, /buildAnalyticsChartsViewModel/);
assert.match(appSource, /import \{ AnalyticsChartsPreview \} from "\.\/features\/analytics\/ui\/index\.js"/);
assert.match(appSource, /<AnalyticsChartsPreview/);

console.log("analytics charts checks passed");
