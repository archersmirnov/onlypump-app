import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  legacyIndex: new URL("../../index.html", import.meta.url),
  app: new URL("../src/App.jsx", import.meta.url),
  routes: new URL("../src/app/previewRoutes.jsx", import.meta.url),
  workoutsPreview: new URL("../src/features/workouts/ui/WorkoutsPreview.jsx", import.meta.url),
  studentsPreview: new URL("../src/features/students/ui/StudentsTrainerPreview.jsx", import.meta.url),
  analyticsPreview: new URL("../src/features/analytics/ui/AnalyticsChartsPreview.jsx", import.meta.url),
  nutritionPreview: new URL("../src/features/nutrition/ui/NutritionScreensPreview.jsx", import.meta.url),
  homePreview: new URL("../src/features/home/ui/HomeWidgetsPreview.jsx", import.meta.url)
};

const sourceEntries = await Promise.all(
  Object.entries(files).map(async ([name, url]) => [name, await readFile(url, "utf8")])
);
const sources = Object.fromEntries(sourceEntries);

assert.doesNotMatch(sources.legacyIndex, /vite-shell\/src|PREVIEW_ROUTES|data-preview-route/);
assert.match(sources.app, /PREVIEW_ROUTES/);
assert.match(sources.routes, /ALL_PREVIEW_ROUTE_ID/);

const previewRouteImports = [
  "HomeWidgetsPreview",
  "NutritionScreensPreview",
  "AnalyticsChartsPreview",
  "WorkoutsPreview",
  "StudentsTrainerPreview"
];

for (const importName of previewRouteImports) {
  assert.match(sources.routes, new RegExp(importName));
}

const writeFlowPatterns = [
  /workoutRepository/,
  /workoutAutosave/,
  /workoutSync/,
  /workoutPendingQueue/,
  /sendWorkoutPatch/,
  /save_workout_patch/,
  /create_workout_tree/,
  /delete_workout/
];

for (const [name, source] of Object.entries(sources)) {
  if (name === "legacyIndex") continue;

  for (const pattern of writeFlowPatterns) {
    assert.doesNotMatch(source, pattern, `${name} should stay preview/read-only`);
  }
}

console.log("integration boundary checks passed");
