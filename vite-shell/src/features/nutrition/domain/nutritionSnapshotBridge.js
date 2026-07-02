import { normalizeNutritionDateKey } from "../cache/index.js";
import { DEFAULT_NUTRITION_GOAL, normalizeNutritionDay } from "./nutritionDay.js";
import { buildNutritionScreensViewModel } from "./nutritionScreenModel.js";

export const NUTRITION_LEGACY_SNAPSHOT_GLOBAL = "__ONLYPUMP_NUTRITION_SNAPSHOT__";
export const NUTRITION_LEGACY_SNAPSHOT_VERSION = 1;

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function readSnapshotPayload(value) {
  if (typeof value !== "function") return value;
  try {
    return value();
  } catch {
    return null;
  }
}

function extractSnapshotPayload(payload) {
  const rawPayload = objectOrNull(readSnapshotPayload(payload));
  if (!rawPayload) {
    return {
      hasSnapshot: false,
      version: NUTRITION_LEGACY_SNAPSHOT_VERSION,
      updatedAt: "",
      snapshot: {}
    };
  }

  const snapshot = objectOrNull(rawPayload.snapshot) || rawPayload;
  return {
    hasSnapshot: Boolean(objectOrNull(rawPayload.snapshot) || objectOrNull(rawPayload.source)),
    version: Number(rawPayload.version || snapshot.version || NUTRITION_LEGACY_SNAPSHOT_VERSION),
    updatedAt: String(rawPayload.updatedAt || snapshot.updatedAt || ""),
    snapshot
  };
}

function normalizeNutritionSnapshotSource(snapshot = {}, options = {}) {
  const root = objectOrNull(snapshot) || {};
  const source = objectOrNull(root.source) || root;
  const goal = objectOrNull(source.goal) || objectOrNull(root.goal) || DEFAULT_NUTRITION_GOAL;
  const selectedDateKey = normalizeNutritionDateKey(
    source.selectedDateKey ||
      source.selected_date_key ||
      root.selectedDateKey ||
      root.selected_date_key ||
      source.date ||
      root.date,
    normalizeNutritionDateKey(options.selectedDateKey || options.date, "")
  );
  const rawDay =
    objectOrNull(source.day) ||
    objectOrNull(source.nutritionDay) ||
    objectOrNull(source.nutrition_day) ||
    objectOrNull(root.day) ||
    objectOrNull(root.nutritionDay) ||
    objectOrNull(root.nutrition_day);

  return {
    day: rawDay ? normalizeNutritionDay(rawDay, selectedDateKey || rawDay.date || rawDay.nutrition_date || "", goal) : null,
    foods: arrayOrEmpty(source.foods || source.foodItems || source.food_items || root.foods || root.foodItems || root.food_items),
    goal,
    profile: objectOrNull(source.profile) || objectOrNull(root.profile) || {},
    selectedMode: source.selectedMode || source.selected_mode || root.selectedMode || root.selected_mode || "",
    selectedCategory: source.selectedCategory || source.selected_category || root.selectedCategory || root.selected_category || "all",
    selectedFilter: source.selectedFilter || source.selected_filter || root.selectedFilter || root.selected_filter || "all",
    selectedDateKey
  };
}

export function normalizeNutritionLegacySnapshotPayload(payload = null, options = {}) {
  const extracted = extractSnapshotPayload(payload);
  return {
    hasSnapshot: extracted.hasSnapshot,
    version: extracted.version,
    updatedAt: extracted.updatedAt,
    source: normalizeNutritionSnapshotSource(extracted.snapshot, options)
  };
}

export function readNutritionLegacySnapshotFromGlobal(globalLike = globalThis, options = {}) {
  return normalizeNutritionLegacySnapshotPayload(globalLike?.[NUTRITION_LEGACY_SNAPSHOT_GLOBAL], options);
}

export function buildNutritionScreensViewModelFromLegacySnapshotGlobal(globalLike = globalThis, options = {}) {
  const bridgeSnapshot = readNutritionLegacySnapshotFromGlobal(globalLike, options);
  const source = bridgeSnapshot.source;
  const viewModel = buildNutritionScreensViewModel({
    day: source.day,
    foods: source.foods,
    goal: source.goal,
    profile: source.profile,
    selectedMode: source.selectedMode,
    selectedCategory: source.selectedCategory,
    selectedFilter: source.selectedFilter
  }, {
    ...options,
    goal: options.goal || source.goal,
    profile: options.profile || source.profile,
    selectedMode: options.selectedMode || source.selectedMode,
    selectedCategory: options.selectedCategory || source.selectedCategory,
    selectedFilter: options.selectedFilter || source.selectedFilter,
    date: options.date || options.selectedDateKey || source.selectedDateKey
  });

  return {
    ...viewModel,
    snapshotBridge: {
      hasSnapshot: bridgeSnapshot.hasSnapshot,
      version: bridgeSnapshot.version,
      updatedAt: bridgeSnapshot.updatedAt
    }
  };
}
