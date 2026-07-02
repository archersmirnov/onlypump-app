import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_HOME_WIDGETS,
  HOME_LAYOUT_DESKTOP,
  buildHomeWidgetPreviewItems,
  buildHomeWidgetValueModel,
  buildHomeWidgetsViewModel,
  buildHomeWidgetsViewModelFromLegacySnapshot,
  buildHomeWidgetsAfterAdding,
  buildHomeWidgetsAfterRemoving,
  enforceHomeWidgetRules,
  homeWidgetsForLayout,
  homeWidgetsStorageWithLayout,
  normalizeHomeWidgetsOrder,
  personalTrackerWidgetId,
  readCachedHomeWidgetsForProfile,
  writeCachedHomeWidgetsForProfile
} from "../src/features/home/domain/index.js";

const routesSource = await readFile(new URL("../src/app/previewRoutes.jsx", import.meta.url), "utf8");
const homeIndexSource = await readFile(new URL("../src/features/home/index.js", import.meta.url), "utf8");
const previewSource = await readFile(new URL("../src/features/home/ui/HomeWidgetsPreview.jsx", import.meta.url), "utf8");

assert.deepEqual(DEFAULT_HOME_WIDGETS, [
  "metricWeight",
  "metricBodyFat",
  "metricTonnage",
  "metricSets",
  "metricCalories",
  "metricProtein",
  "metricRecovery"
]);

assert.deepEqual(
  enforceHomeWidgetRules(["metricWeight", "metricCalories", "nutrition", "metricProtein"]),
  ["metricWeight", "nutrition"]
);
assert.deepEqual(
  buildHomeWidgetsAfterAdding(["metricWeight", "workout"], "metricSteps"),
  ["metricWeight", "metricSteps", "workout"]
);
assert.deepEqual(
  buildHomeWidgetsAfterAdding(["metricWeight", "metricCalories", "metricProtein"], "macros"),
  ["metricWeight", "macros"]
);
assert.deepEqual(
  buildHomeWidgetsAfterRemoving(["metricWeight", "metricSteps", "workout"], "metricSteps"),
  ["metricWeight", "workout"]
);
assert.deepEqual(normalizeHomeWidgetsOrder(["unknown", "metricWeight", "metricWeight"]), ["metricWeight"]);

const trackerWidgetId = personalTrackerWidgetId("coffee");
assert.deepEqual(
  buildHomeWidgetsAfterAdding(["metricWeight", "workout"], trackerWidgetId),
  ["metricWeight", trackerWidgetId, "workout"]
);
assert.equal(buildHomeWidgetPreviewItems([trackerWidgetId])[0].personalTrackerId, "coffee");

const readOnlyModel = buildHomeWidgetsViewModel({
  measurement: { weight: 82.4, body_fat_percent: 18.6 },
  training: { totalVolume: 128400, completedSets: 190 },
  nutrition: { totals: { calories: 2130, protein: 164 } },
  health: { recovery_score: 76, sleep_duration_minutes: 455 },
}, {
  widgets: ["metricWeight", "metricBodyFat", "metricTonnage", "metricSets", "metricCalories", "metricProtein", "metricRecovery", "metricSleep"]
});
assert.equal(readOnlyModel.visibleCount, 8);
assert.equal(readOnlyModel.hasReadOnlyData, true);
assert.equal(readOnlyModel.items.find((item) => item.id === "metricWeight").valueLabel, "82.4 кг");
assert.equal(readOnlyModel.items.find((item) => item.id === "metricBodyFat").valueLabel, "18.6 %");
assert.equal(readOnlyModel.items.find((item) => item.id === "metricTonnage").valueLabel, "128400 кг");
assert.equal(readOnlyModel.items.find((item) => item.id === "metricSets").valueLabel, "190 подходов");
assert.equal(readOnlyModel.items.find((item) => item.id === "metricCalories").valueLabel, "2130 ккал");
assert.equal(readOnlyModel.items.find((item) => item.id === "metricProtein").valueLabel, "164 г");
assert.equal(readOnlyModel.items.find((item) => item.id === "metricRecovery").valueLabel, "76 %");
assert.equal(readOnlyModel.items.find((item) => item.id === "metricSleep").valueLabel, "7 ч 35 мин");
assert.equal(buildHomeWidgetValueModel("metricWeight", {}).hasValue, false);

const legacySnapshotModel = buildHomeWidgetsViewModelFromLegacySnapshot({
  globalSelectedDateKey: "2026-07-02",
  profile: {
    id: "profile-1",
    home_widgets_order: {
      desktop: ["metricWeight", "metricTonnage", "metricSets", "metricCalories", "metricProtein", "metricRecovery"],
    },
  },
  measurementRecords: [
    { measurement_date: "2026-06-30", weight_kg: 80.4, body_fat_percent: 17.8 },
    { measurement_date: "2026-07-02", weight_kg: 81.2, body_fat_percent: 18.1 },
  ],
  workoutSummary: { completedVolume: 12500, completedSets: 42 },
  nutritionTotals: { calories: 2140, protein: 156 },
  healthLog: { recovery_score: 82, sleep_duration_minutes: 435 },
}, {
  layoutMode: HOME_LAYOUT_DESKTOP,
});
assert.equal(legacySnapshotModel.selectedDateKey, "2026-07-02");
assert.deepEqual(legacySnapshotModel.widgets, [
  "metricWeight",
  "metricTonnage",
  "metricSets",
  "metricCalories",
  "metricProtein",
  "metricRecovery",
]);
assert.equal(legacySnapshotModel.items.find((item) => item.id === "metricWeight").valueLabel, "81.2 кг");
assert.equal(legacySnapshotModel.items.find((item) => item.id === "metricTonnage").valueLabel, "12500 кг");
assert.equal(legacySnapshotModel.items.find((item) => item.id === "metricSets").valueLabel, "42 подходов");
assert.equal(legacySnapshotModel.items.find((item) => item.id === "metricCalories").valueLabel, "2140 ккал");
assert.equal(legacySnapshotModel.items.find((item) => item.id === "metricProtein").valueLabel, "156 г");
assert.equal(legacySnapshotModel.items.find((item) => item.id === "metricRecovery").valueLabel, "82 %");

const storageValue = homeWidgetsStorageWithLayout(
  { mobile: ["metricWeight"], desktop: ["workout"] },
  HOME_LAYOUT_DESKTOP,
  ["metricSets"]
);
assert.deepEqual(storageValue, { mobile: ["metricWeight"], desktop: ["metricSets"] });
assert.deepEqual(homeWidgetsForLayout(storageValue, HOME_LAYOUT_DESKTOP), ["metricSets"]);

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value)
};
const profile = { id: "profile-1" };
writeCachedHomeWidgetsForProfile(profile, ["metricWeight", "metricSteps"], {
  storage,
  layoutMode: HOME_LAYOUT_DESKTOP
});
assert.deepEqual(readCachedHomeWidgetsForProfile(profile, { storage, layoutMode: HOME_LAYOUT_DESKTOP }), [
  "metricWeight",
  "metricSteps"
]);

assert.match(homeIndexSource, /domain\/index\.js/);
assert.match(homeIndexSource, /ui\/index\.js/);
assert.match(previewSource, /buildHomeWidgetsViewModel/);
assert.match(routesSource, /import \{ HomeWidgetsPreview \} from "\.\.\/features\/home\/index\.js"/);
assert.match(routesSource, /HOME_WIDGETS_READ_ONLY_PREVIEW_SOURCE/);
assert.match(routesSource, /id: "home"/);
assert.match(routesSource, /<HomeWidgetsPreview/);

console.log("home widgets checks passed");
