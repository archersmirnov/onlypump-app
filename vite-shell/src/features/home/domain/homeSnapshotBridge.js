import { buildHomeWidgetsViewModelFromLegacySnapshot } from "./homeLegacySnapshot.js";

export const HOME_LEGACY_SNAPSHOT_GLOBAL = "__ONLYPUMP_HOME_SNAPSHOT__";
export const HOME_LEGACY_SNAPSHOT_VERSION = 1;

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
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

export function normalizeHomeLegacySnapshotPayload(payload) {
  const { payload: payloadObject, snapshot, hasSnapshot } = extractSnapshot(payload);

  return {
    version: Number(payloadObject.version || snapshot.version || HOME_LEGACY_SNAPSHOT_VERSION),
    updatedAt: String(payloadObject.updatedAt || snapshot.updatedAt || ""),
    snapshot,
    hasSnapshot,
  };
}

export function readHomeLegacySnapshotFromGlobal(globalLike = globalThis) {
  const source = objectOrNull(globalLike);
  if (!source) {
    return normalizeHomeLegacySnapshotPayload(null);
  }

  return normalizeHomeLegacySnapshotPayload(source[HOME_LEGACY_SNAPSHOT_GLOBAL]);
}

export function buildHomeWidgetsViewModelFromHomeSnapshotGlobal(globalLike = globalThis, options = {}) {
  const bridgeSnapshot = readHomeLegacySnapshotFromGlobal(globalLike);
  const viewModel = buildHomeWidgetsViewModelFromLegacySnapshot(bridgeSnapshot.snapshot, options);

  return {
    ...viewModel,
    snapshotBridge: {
      hasSnapshot: bridgeSnapshot.hasSnapshot,
      version: bridgeSnapshot.version,
      updatedAt: bridgeSnapshot.updatedAt,
    },
  };
}
