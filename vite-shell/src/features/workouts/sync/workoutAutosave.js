import {
  notifyWorkoutSyncEvent,
  summarizeWorkoutSyncPatch
} from "./workoutSync.js";

export function requireWorkoutAutosaveSyncController(syncController) {
  if (
    !syncController ||
    typeof syncController.queuePatch !== "function" ||
    typeof syncController.flushPatch !== "function" ||
    typeof syncController.flushAll !== "function"
  ) {
    throw new TypeError("createWorkoutAutosaveScheduler requires queuePatch, flushPatch and flushAll");
  }
  return syncController;
}

export function createWorkoutAutosaveEvent(phase, details = {}) {
  return {
    domain: "workouts.autosave",
    phase,
    workoutId: details.workoutId || null,
    delayMs: details.delayMs,
    patchSummary: summarizeWorkoutSyncPatch(details.patch),
    result: details.result || null
  };
}

export function emitWorkoutAutosaveEvent(onEvent, phase, details = {}) {
  return notifyWorkoutSyncEvent(onEvent, createWorkoutAutosaveEvent(phase, details));
}

export function createWorkoutAutosaveScheduler({
  syncController,
  delayMs = 700,
  setTimer = (callback, timeoutMs) => setTimeout(callback, timeoutMs),
  clearTimer = (timerId) => clearTimeout(timerId),
  onEvent = null
} = {}) {
  const sync = requireWorkoutAutosaveSyncController(syncController);
  const timers = new Map();

  const cancel = (workoutId) => {
    if (!timers.has(workoutId)) return false;
    clearTimer(timers.get(workoutId));
    timers.delete(workoutId);
    emitWorkoutAutosaveEvent(onEvent, "cancelled", { workoutId });
    return true;
  };

  const flushPatch = async (workoutId) => {
    cancel(workoutId);
    emitWorkoutAutosaveEvent(onEvent, "flushing", { workoutId });
    const result = await sync.flushPatch(workoutId);
    emitWorkoutAutosaveEvent(onEvent, "flushed", { workoutId, result });
    return result;
  };

  const schedule = (workoutId, patch, options = {}) => {
    cancel(workoutId);
    if (options.immediate) {
      emitWorkoutAutosaveEvent(onEvent, "immediate", { workoutId, patch });
      return flushPatch(workoutId);
    }

    const timerId = setTimer(() => {
      timers.delete(workoutId);
      void flushPatch(workoutId);
    }, options.delayMs ?? delayMs);
    timers.set(workoutId, timerId);
    emitWorkoutAutosaveEvent(onEvent, "scheduled", {
      workoutId,
      patch,
      delayMs: options.delayMs ?? delayMs
    });
    return timerId;
  };

  return {
    queuePatch(workoutId, patch, options = {}) {
      const queuedPatch = sync.queuePatch(workoutId, patch);
      if (!queuedPatch) return queuedPatch;
      schedule(workoutId, queuedPatch, options);
      return queuedPatch;
    },

    schedule,

    cancel,

    cancelAll() {
      const ids = Array.from(timers.keys());
      ids.forEach((workoutId) => cancel(workoutId));
      return ids;
    },

    hasTimer(workoutId) {
      return timers.has(workoutId);
    },

    pendingTimerIds() {
      return Array.from(timers.keys());
    },

    flushPatch,

    async flushAll() {
      this.cancelAll();
      emitWorkoutAutosaveEvent(onEvent, "flush_all");
      return sync.flushAll();
    }
  };
}
