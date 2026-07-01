import {
  buildWorkoutExerciseSupabasePayload,
  buildWorkoutSetSupabasePayload,
  buildWorkoutSupabasePayload,
  buildWorkoutTreeCreatePayload,
  buildWorkoutTreeFromApi,
  buildWorkoutTreePatch,
  buildWorkoutTreeUpdatePayload
} from "./workoutMapper.js";

export const WORKOUT_REPOSITORY_ACTIONS = Object.freeze({
  load: "load",
  loadExerciseLibrary: "load_exercise_library",
  loadProgramTemplates: "load_program_templates",
  loadUserPrograms: "load_user_programs",
  exerciseHistory: "exercise_history",
  createWorkout: "create_workout",
  createWorkoutTree: "create_workout_tree",
  updateWorkout: "update_workout",
  updateWorkoutTree: "update_workout_tree",
  saveWorkoutPatch: "save_workout_patch",
  deleteWorkout: "delete_workout",
  createExercise: "create_exercise",
  updateExercise: "update_exercise",
  deleteExercise: "delete_exercise",
  createSet: "create_set",
  updateSet: "update_set",
  deleteSet: "delete_set",
  saveProgramTemplate: "save_program_template",
  updateProgramTemplate: "update_program_template",
  shareProgramTemplate: "share_program_template",
  createUserProgram: "create_user_program",
  renameWorkoutScope: "rename_workout_scope",
  deleteWorkoutScope: "delete_workout_scope",
  deleteProgramScope: "delete_program_scope"
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

export function buildWorkoutProfilePayload(input = {}, fallbackProfileId = null, label = "workout request") {
  const profileId = resolveWorkoutProfileId(input, fallbackProfileId);
  if (!profileId) throw new Error(`profile_id is required for ${label}`);
  return { profile_id: profileId };
}

export function buildWorkoutPassthroughPayload(input = {}, fallbackProfileId = null, label = "workout request") {
  const source = input && typeof input === "object" ? input : {};
  const profileId = resolveWorkoutProfileId(source, fallbackProfileId);
  if (!profileId) throw new Error(`profile_id is required for ${label}`);
  return { ...source, profile_id: profileId };
}

export function buildWorkoutLoadPayload(input = {}, fallbackProfileId = null) {
  return buildWorkoutProfilePayload(input, fallbackProfileId, "load workouts");
}

export function buildWorkoutCreateApiPayload(workout, options = {}) {
  const profileId = resolveWorkoutProfileId(options, null);
  if (!profileId) throw new Error("profile_id is required to create workout");
  if (!workout) throw new Error("workout is required to create workout");
  const workoutPayload = buildWorkoutSupabasePayload(workout, { ...options.mapperOptions, profileId });
  return {
    profile_id: profileId,
    workout: workoutPayload,
    ...workoutPayload
  };
}

export function buildWorkoutUpdateApiPayload(workout, options = {}) {
  const profileId = resolveWorkoutProfileId(options, null);
  const workoutId = workout?.supabaseId || workout?.id || workout?.workout_id;
  if (!profileId) throw new Error("profile_id is required to update workout");
  if (!workoutId) throw new Error("workout id is required to update workout");
  const workoutPayload = buildWorkoutSupabasePayload(workout, { ...options.mapperOptions, profileId });
  return {
    profile_id: profileId,
    id: workoutId,
    workout_id: workoutId,
    workout: workoutPayload,
    ...workoutPayload
  };
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

export function buildWorkoutExerciseCreateApiPayload(workoutId, exercise, options = {}) {
  const profileId = resolveWorkoutProfileId(options, null);
  const workoutSupabaseId = workoutId || options.workoutId || options.workout_id;
  if (!profileId) throw new Error("profile_id is required to create exercise");
  if (!workoutSupabaseId) throw new Error("workout_id is required to create exercise");
  if (!exercise) throw new Error("exercise is required to create exercise");

  const exercisePayload = buildWorkoutExerciseSupabasePayload(workoutSupabaseId, exercise, options.mapperOptions || {});
  return {
    profile_id: profileId,
    workout_id: workoutSupabaseId,
    exercise: exercisePayload,
    ...exercisePayload
  };
}

export function buildWorkoutExerciseUpdateApiPayload(workoutId, exercise, options = {}) {
  const profileId = resolveWorkoutProfileId(options, null);
  const workoutSupabaseId = workoutId || options.workoutId || options.workout_id;
  const exerciseId = exercise?.supabaseId || exercise?.id || exercise?.exercise_id || exercise?.workout_exercise_id;
  if (!profileId) throw new Error("profile_id is required to update exercise");
  if (!workoutSupabaseId) throw new Error("workout_id is required to update exercise");
  if (!exerciseId) throw new Error("exercise id is required to update exercise");

  const exercisePayload = buildWorkoutExerciseSupabasePayload(workoutSupabaseId, exercise, options.mapperOptions || {});
  return {
    profile_id: profileId,
    workout_id: workoutSupabaseId,
    id: exerciseId,
    exercise_id: exerciseId,
    workout_exercise_id: exerciseId,
    exercise: exercisePayload,
    ...exercisePayload
  };
}

export function buildWorkoutExerciseDeletePayload(exerciseOrId, fallbackProfileId = null) {
  const exerciseId = typeof exerciseOrId === "string"
    ? exerciseOrId
    : exerciseOrId?.supabaseId || exerciseOrId?.id || exerciseOrId?.exercise_id || exerciseOrId?.workout_exercise_id;
  const profileId = resolveWorkoutProfileId(
    typeof exerciseOrId === "object" && exerciseOrId ? exerciseOrId : {},
    fallbackProfileId
  );

  if (!profileId) throw new Error("profile_id is required to delete exercise");
  if (!exerciseId) throw new Error("exercise id is required to delete exercise");

  return {
    profile_id: profileId,
    id: exerciseId,
    exercise_id: exerciseId,
    workout_exercise_id: exerciseId
  };
}

export function buildWorkoutSetCreateApiPayload(exerciseId, set, options = {}) {
  const profileId = resolveWorkoutProfileId(options, null);
  const exerciseSupabaseId = exerciseId || options.exerciseId || options.exercise_id || options.workoutExerciseId || options.workout_exercise_id;
  if (!profileId) throw new Error("profile_id is required to create set");
  if (!exerciseSupabaseId) throw new Error("workout_exercise_id is required to create set");
  if (!set) throw new Error("set is required to create set");

  const setPayload = buildWorkoutSetSupabasePayload(exerciseSupabaseId, set);
  return {
    profile_id: profileId,
    workout_exercise_id: exerciseSupabaseId,
    set: setPayload,
    ...setPayload
  };
}

export function buildWorkoutSetUpdateApiPayload(exerciseId, set, options = {}) {
  const profileId = resolveWorkoutProfileId(options, null);
  const exerciseSupabaseId = exerciseId || options.exerciseId || options.exercise_id || options.workoutExerciseId || options.workout_exercise_id;
  const setId = set?.supabaseId || set?.id || set?.set_id || set?.workout_set_id;
  if (!profileId) throw new Error("profile_id is required to update set");
  if (!exerciseSupabaseId) throw new Error("workout_exercise_id is required to update set");
  if (!setId) throw new Error("set id is required to update set");

  const setPayload = buildWorkoutSetSupabasePayload(exerciseSupabaseId, set);
  return {
    profile_id: profileId,
    workout_exercise_id: exerciseSupabaseId,
    id: setId,
    set_id: setId,
    workout_set_id: setId,
    set: setPayload,
    ...setPayload
  };
}

export function buildWorkoutSetDeletePayload(setOrId, fallbackProfileId = null) {
  const setId = typeof setOrId === "string"
    ? setOrId
    : setOrId?.supabaseId || setOrId?.id || setOrId?.set_id || setOrId?.workout_set_id;
  const profileId = resolveWorkoutProfileId(
    typeof setOrId === "object" && setOrId ? setOrId : {},
    fallbackProfileId
  );

  if (!profileId) throw new Error("profile_id is required to delete set");
  if (!setId) throw new Error("set id is required to delete set");

  return {
    profile_id: profileId,
    id: setId,
    set_id: setId,
    workout_set_id: setId
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

export function isWorkoutMutationResponseOk(result) {
  return Boolean(result) && result.ok !== false && result.success !== false && !result.error;
}

export function readWorkoutRepositoryArray(result, primaryKey, fallbackKeys = []) {
  if (!result || typeof result !== "object") return [];
  for (const key of [primaryKey, ...fallbackKeys].filter(Boolean)) {
    const value = result[key];
    if (Array.isArray(value)) return value;
  }
  return [];
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

    async loadExerciseLibrary(input = {}, options = {}) {
      const payload = buildWorkoutProfilePayload(input, options.profileId || profileId, "load exercise library");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.loadExerciseLibrary, payload);
      const exercises = readWorkoutRepositoryArray(result, "exercise_library", ["exercises", "items"]);
      return {
        payload,
        result,
        exercises,
        exerciseLibrary: exercises
      };
    },

    async loadProgramTemplates(input = {}, options = {}) {
      const payload = buildWorkoutProfilePayload(input, options.profileId || profileId, "load program templates");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.loadProgramTemplates, payload);
      const templates = readWorkoutRepositoryArray(result, "program_templates", ["templates"]);
      return {
        payload,
        result,
        templates,
        programTemplates: templates
      };
    },

    async loadUserPrograms(input = {}, options = {}) {
      const payload = buildWorkoutProfilePayload(input, options.profileId || profileId, "load user programs");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.loadUserPrograms, payload);
      const userPrograms = readWorkoutRepositoryArray(result, "user_programs", ["programs"]);
      return {
        payload,
        result,
        userPrograms,
        programs: userPrograms
      };
    },

    async loadExerciseHistory(input = {}, options = {}) {
      const payload = buildWorkoutPassthroughPayload(input, options.profileId || profileId, "load exercise history");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.exerciseHistory, payload);
      const history = readWorkoutRepositoryArray(result, "history", ["exercise_history", "records", "items"]);
      return {
        payload,
        result,
        history,
        records: history
      };
    },

    async createWorkout(workout, options = {}) {
      const payload = buildWorkoutCreateApiPayload(workout, {
        ...options,
        profileId: options.profileId || profileId,
        mapperOptions: { ...mapperOptions, ...(options.mapperOptions || {}) }
      });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.createWorkout, payload);
      return { payload, result };
    },

    async createWorkoutTree(workout, options = {}) {
      if (!workout) return null;
      const payload = buildWorkoutTreeCreatePayload(workout, { ...mapperOptions, ...(options.mapperOptions || {}) });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.createWorkoutTree, payload);
      return { payload, result };
    },

    async updateWorkout(workout, options = {}) {
      const payload = buildWorkoutUpdateApiPayload(workout, {
        ...options,
        profileId: options.profileId || profileId,
        mapperOptions: { ...mapperOptions, ...(options.mapperOptions || {}) }
      });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.updateWorkout, payload);
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
    },

    async createExercise(workoutId, exercise, options = {}) {
      const payload = buildWorkoutExerciseCreateApiPayload(workoutId, exercise, {
        ...options,
        profileId: options.profileId || profileId,
        mapperOptions: { ...mapperOptions, ...(options.mapperOptions || {}) }
      });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.createExercise, payload);
      return { payload, result };
    },

    async updateExercise(workoutId, exercise, options = {}) {
      const payload = buildWorkoutExerciseUpdateApiPayload(workoutId, exercise, {
        ...options,
        profileId: options.profileId || profileId,
        mapperOptions: { ...mapperOptions, ...(options.mapperOptions || {}) }
      });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.updateExercise, payload);
      return { payload, result };
    },

    async deleteExercise(exerciseOrId, options = {}) {
      const payload = buildWorkoutExerciseDeletePayload(exerciseOrId, options.profileId || profileId);
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.deleteExercise, payload);
      return { payload, result, confirmed: isWorkoutMutationResponseOk(result) };
    },

    async createSet(exerciseId, set, options = {}) {
      const payload = buildWorkoutSetCreateApiPayload(exerciseId, set, {
        ...options,
        profileId: options.profileId || profileId
      });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.createSet, payload);
      return { payload, result };
    },

    async updateSet(exerciseId, set, options = {}) {
      const payload = buildWorkoutSetUpdateApiPayload(exerciseId, set, {
        ...options,
        profileId: options.profileId || profileId
      });
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.updateSet, payload);
      return { payload, result };
    },

    async deleteSet(setOrId, options = {}) {
      const payload = buildWorkoutSetDeletePayload(setOrId, options.profileId || profileId);
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.deleteSet, payload);
      return { payload, result, confirmed: isWorkoutMutationResponseOk(result) };
    },

    async saveProgramTemplate(programPayload, options = {}) {
      const payload = buildWorkoutPassthroughPayload(programPayload, options.profileId || profileId, "save program template");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.saveProgramTemplate, payload);
      return { payload, result };
    },

    async updateProgramTemplate(programPayload, options = {}) {
      const payload = buildWorkoutPassthroughPayload(programPayload, options.profileId || profileId, "update program template");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.updateProgramTemplate, payload);
      return { payload, result };
    },

    async shareProgramTemplate(programPayload, options = {}) {
      const payload = buildWorkoutPassthroughPayload(programPayload, options.profileId || profileId, "share program template");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.shareProgramTemplate, payload);
      return { payload, result };
    },

    async createUserProgram(programPayload, options = {}) {
      const payload = buildWorkoutPassthroughPayload(programPayload, options.profileId || profileId, "create user program");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.createUserProgram, payload);
      return { payload, result };
    },

    async renameWorkoutScope(scopePayload, options = {}) {
      const payload = buildWorkoutPassthroughPayload(scopePayload, options.profileId || profileId, "rename workout scope");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.renameWorkoutScope, payload);
      return { payload, result, confirmed: isWorkoutMutationResponseOk(result) };
    },

    async deleteWorkoutScope(scopePayload, options = {}) {
      const payload = buildWorkoutPassthroughPayload(scopePayload, options.profileId || profileId, "delete workout scope");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.deleteWorkoutScope, payload);
      return { payload, result, confirmed: isWorkoutDeleteResponseConfirmed(result, payload.workout_id || payload.id || payload) };
    },

    async deleteProgramScope(scopePayload, options = {}) {
      const payload = buildWorkoutPassthroughPayload(scopePayload, options.profileId || profileId, "delete program scope");
      const result = await call(WORKOUT_REPOSITORY_ACTIONS.deleteProgramScope, payload);
      return { payload, result, confirmed: isWorkoutDeleteResponseConfirmed(result, payload.workout_id || payload.id || payload) };
    }
  };
}
