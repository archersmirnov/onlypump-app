import {
  createWorkoutPendingQueue,
  getWorkoutFailedState,
  getWorkoutQueuedState,
  getWorkoutSavedState,
  getWorkoutSendingState,
  workoutPatchHasChanges
} from "./workoutPendingQueue.js";

export function requireWorkoutSyncRepository(repository) {
  if (!repository || typeof repository.saveWorkoutPatch !== "function") {
    throw new TypeError("createWorkoutSyncController requires repository.saveWorkoutPatch");
  }
  return repository;
}

export function applyWorkoutSyncState(applyWorkoutState, workoutId, stateFactory, meta = {}) {
  if (typeof applyWorkoutState !== "function" || !workoutId) return null;
  return applyWorkoutState(workoutId, stateFactory, meta);
}

export function isWorkoutSyncSuccess(value) {
  const result = value?.result || value;
  return Boolean(result) && result.ok !== false && result.success !== false && !result.error;
}

export function summarizeWorkoutSyncPatch(patch = {}) {
  if (!patch || typeof patch !== "object") return {};
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => Array.isArray(value) && value.length)
      .map(([key, value]) => [key, value.length])
  );
}

export function normalizeWorkoutSyncError(error) {
  if (!error) return { message: "Unknown workout sync error" };
  if (typeof error === "string") return { message: error };
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  if (typeof error === "object") {
    return {
      name: error.name || error.code || "WorkoutSyncError",
      message: error.message || error.error || JSON.stringify(error),
      code: error.code,
      status: error.status,
      details: error.details,
      hint: error.hint
    };
  }
  return { message: String(error) };
}

export function createWorkoutSyncEvent(phase, details = {}) {
  return {
    domain: "workouts.sync",
    phase,
    workoutId: details.workoutId || null,
    skipped: Boolean(details.skipped),
    ok: details.ok,
    hasNewerPatch: Boolean(details.hasNewerPatch),
    patchSummary: summarizeWorkoutSyncPatch(details.patch),
    pendingPatchSummary: summarizeWorkoutSyncPatch(details.pendingPatch),
    error: details.error ? normalizeWorkoutSyncError(details.error) : null
  };
}

export function notifyWorkoutSyncEvent(onEvent, event) {
  if (typeof onEvent !== "function") return event;
  try {
    onEvent(event);
  } catch {
    // Sync must not fail because an observer failed to log.
  }
  return event;
}

export function createWorkoutSyncController({
  repository,
  pendingQueue = createWorkoutPendingQueue(),
  applyWorkoutState = null,
  onEvent = null,
  now = () => new Date().toISOString()
} = {}) {
  const workoutRepository = requireWorkoutSyncRepository(repository);
  const emitSyncEvent = (phase, details = {}) => notifyWorkoutSyncEvent(
    onEvent,
    createWorkoutSyncEvent(phase, details)
  );

  const applyQueuedState = (workoutId, patch) => applyWorkoutSyncState(
    applyWorkoutState,
    workoutId,
    (workout = {}) => getWorkoutQueuedState(workout, patch),
    { phase: "queued", patch }
  );

  const applySendingState = (workoutId, patch) => applyWorkoutSyncState(
    applyWorkoutState,
    workoutId,
    (workout = {}) => getWorkoutSendingState(workout, patch),
    { phase: "sending", patch }
  );

  const applySavedState = (workoutId, sentPatch) => applyWorkoutSyncState(
    applyWorkoutState,
    workoutId,
    (workout = {}) => getWorkoutSavedState(workout, { now: now() }),
    { phase: "saved", patch: sentPatch }
  );

  const applyFailedState = (workoutId, patch, error) => applyWorkoutSyncState(
    applyWorkoutState,
    workoutId,
    (workout = {}) => getWorkoutFailedState(workout, patch),
    { phase: "failed", patch, error }
  );

  return {
    queuePatch(workoutId, patch) {
      const queuedPatch = pendingQueue.queue(workoutId, patch);
      if (queuedPatch) {
        applyQueuedState(workoutId, queuedPatch);
        emitSyncEvent("queued", { workoutId, patch: queuedPatch });
      }
      return queuedPatch;
    },

    getPendingPatch(workoutId) {
      return pendingQueue.get(workoutId);
    },

    hasPendingPatch(workoutId) {
      return pendingQueue.has(workoutId);
    },

    clearPendingPatch(workoutId) {
      pendingQueue.clear(workoutId);
    },

    pendingWorkoutIds() {
      return pendingQueue.ids();
    },

    async flushPatch(workoutId) {
      const patch = pendingQueue.get(workoutId);
      if (!workoutId || !workoutPatchHasChanges(patch)) {
        emitSyncEvent("skipped", { workoutId, patch: patch || null, skipped: true, ok: true });
        return { ok: true, skipped: true, workoutId, patch: patch || null };
      }

      applySendingState(workoutId, patch);
      emitSyncEvent("sending", { workoutId, patch });

      try {
        const response = await workoutRepository.saveWorkoutPatch(null, { prebuiltPatch: patch });
        if (!isWorkoutSyncSuccess(response)) {
          throw new Error(response?.result?.error || response?.error || "save_workout_patch was not confirmed");
        }

        const pendingPatchAfterSave = pendingQueue.get(workoutId);
        const hasNewerPatch = pendingPatchAfterSave && pendingPatchAfterSave !== patch;
        if (!hasNewerPatch) {
          pendingQueue.clear(workoutId);
          applySavedState(workoutId, patch);
        } else {
          applyQueuedState(workoutId, pendingPatchAfterSave);
        }

        emitSyncEvent("saved", {
          workoutId,
          patch,
          pendingPatch: hasNewerPatch ? pendingPatchAfterSave : null,
          hasNewerPatch,
          ok: true
        });

        return {
          ok: true,
          workoutId,
          patch,
          response,
          hasNewerPatch,
          pendingPatch: hasNewerPatch ? pendingPatchAfterSave : null
        };
      } catch (error) {
        applyFailedState(workoutId, patch, error);
        emitSyncEvent("failed", { workoutId, patch, error, ok: false });
        return {
          ok: false,
          workoutId,
          patch,
          error
        };
      }
    },

    async retryPatch(workoutId) {
      return this.flushPatch(workoutId);
    },

    async flushAll() {
      const ids = pendingQueue.ids();
      const results = [];
      for (const workoutId of ids) {
        results.push(await this.flushPatch(workoutId));
      }
      return results;
    }
  };
}
