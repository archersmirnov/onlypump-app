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

export function createWorkoutSyncController({
  repository,
  pendingQueue = createWorkoutPendingQueue(),
  applyWorkoutState = null,
  now = () => new Date().toISOString()
} = {}) {
  const workoutRepository = requireWorkoutSyncRepository(repository);

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
      if (queuedPatch) applyQueuedState(workoutId, queuedPatch);
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
        return { ok: true, skipped: true, workoutId, patch: patch || null };
      }

      applySendingState(workoutId, patch);

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
