import { buildAnalyticsChartsScreenViewModel } from "./analyticsChartModel.js";
import { formatAnalyticsDateKey, normalizeAnalyticsDateKey } from "./analyticsData.js";

export const ANALYTICS_LEGACY_SNAPSHOT_GLOBAL = "__ONLYPUMP_ANALYTICS_SNAPSHOT__";
export const ANALYTICS_LEGACY_SNAPSHOT_VERSION = 1;

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function readPayload(payload) {
  if (typeof payload === "function") {
    return payload();
  }
  return payload;
}

function extractSnapshot(payload) {
  const rawPayload = readPayload(payload);
  const payloadObject = objectOrNull(rawPayload);
  if (!payloadObject) {
    return { payload: {}, snapshot: {}, hasSnapshot: false };
  }

  const snapshot =
    objectOrNull(payloadObject.snapshot) ||
    objectOrNull(payloadObject.data) ||
    payloadObject;

  return {
    payload: payloadObject,
    snapshot,
    hasSnapshot: Object.keys(snapshot).length > 0,
  };
}

function normalizeAnalyticsSnapshotSource(snapshot = {}) {
  const source = objectOrNull(snapshot.source) || snapshot;
  return {
    measurements: arrayOrEmpty(source.measurements),
    healthLogs: arrayOrEmpty(source.healthLogs || source.health_logs),
    nutritionDays: arrayOrEmpty(source.nutritionDays || source.nutrition_days),
    workouts: arrayOrEmpty(source.workouts),
  };
}

export function normalizeAnalyticsLegacySnapshotPayload(payload) {
  const { payload: payloadObject, snapshot, hasSnapshot } = extractSnapshot(payload);
  const selectedDateKey = normalizeAnalyticsDateKey(
    snapshot.selectedDateKey || snapshot.selected_date_key || payloadObject.selectedDateKey,
    formatAnalyticsDateKey(new Date())
  );

  return {
    version: Number(payloadObject.version || snapshot.version || ANALYTICS_LEGACY_SNAPSHOT_VERSION),
    updatedAt: String(payloadObject.updatedAt || snapshot.updatedAt || ""),
    snapshot,
    source: normalizeAnalyticsSnapshotSource(snapshot),
    period: snapshot.period || payloadObject.period || "year",
    selectedDateKey,
    title: snapshot.title || payloadObject.title || "Графики",
    hasSnapshot,
  };
}

export function readAnalyticsLegacySnapshotFromGlobal(globalLike = globalThis) {
  const source = objectOrNull(globalLike);
  if (!source) {
    return normalizeAnalyticsLegacySnapshotPayload(null);
  }

  return normalizeAnalyticsLegacySnapshotPayload(source[ANALYTICS_LEGACY_SNAPSHOT_GLOBAL]);
}

export function buildAnalyticsChartsScreenViewModelFromLegacySnapshotGlobal(globalLike = globalThis, options = {}) {
  const bridgeSnapshot = readAnalyticsLegacySnapshotFromGlobal(globalLike);
  const viewModel = buildAnalyticsChartsScreenViewModel(bridgeSnapshot.source, {
    period: options.period || bridgeSnapshot.period,
    selectedDateKey: options.selectedDateKey || bridgeSnapshot.selectedDateKey,
    title: options.title || bridgeSnapshot.title,
    ...options,
  });

  return {
    ...viewModel,
    snapshotBridge: {
      hasSnapshot: bridgeSnapshot.hasSnapshot,
      version: bridgeSnapshot.version,
      updatedAt: bridgeSnapshot.updatedAt,
    },
  };
}
