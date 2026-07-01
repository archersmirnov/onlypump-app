import {
  buildWorkoutTreeCreatePayload,
  buildWorkoutTreeFromApi,
  buildWorkoutTreePatch,
  buildWorkoutTreeUpdatePayload
} from "./workoutMapper.js";

export const WORKOUT_REPOSITORY_ACTIONS = Object.freeze({
  load: "load",
  createWorkoutTree: "create_workout_tree",
  updateWorkoutTree: "update_workout_tree",
  saveWorkoutPatch: "save_workout_patch",
  deleteWorkout: "delete_workout"
});

const WORKOUT_DELETE_RESPONSE_ID_KEYS = Object.freeze([
  "deleted_workout_ids",
  "deletedWorkoutIds",
  "deleted_ids",
  "deletedIds",
  "workout_ids",
  "workoutIds"
]);

const WORKOUT_DELETE_RESPONSE_COUNT_KEYS = Object.freeze([
  "deleted_count",
  "deletedCount",
  "deleted_workouts_count",
  "deletedWorkoutsCount",
  "affected_count",
  "affectedCount",
  "count"
]);

export function requireWorkoutApiCaller(callWorkoutsApi) {
  if (typeof callWorkoutsApi !== "function") {
    throw new TypeError("createWorkoutRepository requires callWorkoutsApi");
  }
  return callWorkoutsApi;
}

export function resolveWorkoutProfileId(input = {}, fallbackProfileId = null) {
  return input.profile_id || input.profileId || fallbackProfileId || null;
}

export function buildWorkoutLoadPayload(input = {}, fallbackProfileId = null) {
  const profileId = resolveWorkoutProfileId(input, fallbackProfileId);
  if (!profileId) throw new Error("profile_id is required to load workouts");
  return { profile_id: profileId };
}

export function buildWorkoutDeletePayload(workoutOrId, fallbackProfileId = null) {
  const workoutId = typeof workoutOrId === "string"
    ? workoutOrId
    : workoutOrId?.supabaseId || workoutOrId?.id || workoutOrId?.workout_id;
  const profileId = resolveWorkoutProfileId(
    typeof workoutOrId === "object" && workoutOrId ? workoutOrId : {},
    fallbackProfileId
  );

  if (!profileId) throw new Error("profile_id is required to delete workout");
  if (!workoutId) throw new Error("workout id is required to delete workout");

  return {
    profile_id: profileId,
    id: workoutId,
    workout_id: workoutId
  };
}

function readDeleteResponseArray(result, keys) {
  if (!result || typeof result !== "object") return [];
  for (const key of keys) {
    const value = result[key];
    if (Array.isArray(value)) return value;
    if (value !== undefined && value !== null) return [value];
  }
  return [];
}

function getWorkoutDeleteKeys(workoutOrId) {
  if (typeof workoutOrId === "string") return [workoutOrId];
  return [
    workoutOrId?.supabaseId,
    workoutOrId?.id,
    workoutOrId?.workout_id,
    workoutOrId?.workoutId
  ].filter(Boolean).map(String);
}

function hasDeletedWorkoutResponseIds(result) {
  return Boolean(
    result &&
    typeof result === "object" &&
    WORKOUT_DELETE_RESPONSE_ID_KEYS.some((key) => Object.prototype.hasOwnProperty.call(result, key))
  );
}

function getDeleteResponseCount(result) {
  if (!result || typeof result !== "object") return null;
  for (const key of WORKOUT_DELETE_RESPONSE_COUNT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) continue;
    const count = Number(result[key]);
    return Number.isFinite(count) ? count : null;
  }
  return null;
}

export function isWorkoutDeleteResponseConfirmed(result, workoutOrId) {
  if (!result || result.ok === false || result.success === false || result.error) return false;
  const deletedCount = getDeleteResponseCount(result);
  if (deletedCount !== null && deletedCount <= 0) return false;
  const deletedIds = new Set(readDeleteResponseArray(result, WORKOUT_DELETE_RESPONSE_ID_KEYS).map((item) => String(item)));
  if (hasDeletedWorkoutResponseIds(result) && !deletedIds.size) return false;
  if (!deletedIds.size) return true;
  return getWorkoutDeleteKeys(workoutOrId).some((key) => deletedIds.has(String(key)));
}

export function createWorkoutRepository({
  callWorkoutsApi,
  profileId = null,
  mapperOptions = {}
} = {}) {
  const callApi = requireWorkoutApiCaller(callWorkoutsApi);

  const call = (action, payload = {}) => callApi(action, payload);

  return {
    call,

    async loadWorkouts(input = {}, options = {}) {
      const payload = buildWorkoutLoadPayload(input, options.profileId || profileId);
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.load, payload);
      return {
        payload,
        result,
        workouts: buildWorkoutTreeFromApi(result, { ...mapperOptions, ...(options.mapperOptions || {}) })
      };
    },

    async createWorkoutTree(workout, options = {}) {
      if (!workout) return null;
      const payload = buildWorkoutTreeCreatePayload(workout, { ...mapperOptions, ...(options.mapperOptions || {}) });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.createWorkoutTree, payload);
      return { payload, result };
    },

    async updateWorkoutTree(workout, options = {}) {
      if (!workout?.supabaseId) return null;
      const payload = buildWorkoutTreeUpdatePayload(workout, { ...mapperOptions, ...(options.mapperOptions || {}) });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.updateWorkoutTree, payload);
      return { payload, result };
    },

    async saveWorkoutPatch(workout, options = {}) {
      const payload = options.prebuiltPatch || buildWorkoutTreePatch(workout, { ...mapperOptions, ...(options.mapperOptions || {}) });
      if (!payload) return null;
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.saveWorkoutPatch, payload);
      return { payload, result };
    },

    async deleteWorkout(workoutOrId, options = {}) {
      const payload = buildWorkoutDeletePayload(workoutOrId, options.profileId || profileId);
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.deleteWorkout, payload);
      return {
        payload,
        result,
        confirmed: isWorkoutDeleteResponseConfirmed(result, workoutOrId)
      };
    }
  };
}
