import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_HOME_WIDGETS,
  HOME_LAYOUT_DESKTOP,
  buildHomeWidgetPreviewItems,
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

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
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
assert.match(previewSource, /buildHomeWidgetPreviewItems/);
assert.match(appSource, /import \{ HomeWidgetsPreview \} from "\.\/features\/home\/index\.js"/);
assert.match(appSource, /<HomeWidgetsPreview/);

console.log("home widgets checks passed");
