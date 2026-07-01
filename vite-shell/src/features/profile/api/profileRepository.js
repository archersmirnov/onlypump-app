import {
  getMeasurementDateKey,
  mergeHealthLogLists,
  normalizeHealthLog,
  normalizeMeasurementValues,
  normalizeProfileDateKey
} from "../domain/index.js";

export const PROFILE_REPOSITORY_ACTIONS = Object.freeze({
  loadProfile: "load_profile",
  updateProfile: "update_profile",
  completeOnboarding: "complete_onboarding",
  resetProfile: "reset_profile",
  updateThemeSettings: "update_theme_settings",
  updateAnalyticsCardSettings: "update_analytics_card_settings",
  updateHomeState: "update_home_state",
  updateTutorialState: "update_tutorial_state",
  loadHealthLog: "load_health_log",
  saveHealthLog: "save_health_log",
  loadProgress: "load_progress",
  saveProgressMeasurement: "save_progress_measurement",
  loadAnalytics: "load_analytics"
});

export function requireProfileApiCaller(callProfileApi) {
  if (typeof callProfileApi !== "function") {
    throw new TypeError("createProfileRepository requires callProfileApi");
  }
  return callProfileApi;
}

export function resolveProfilePayloadDateKey(input = {}, fallbackDateKey = "") {
  const source = typeof input === "string"
    ? input
    : input?.date || input?.log_date || input?.measurement_date || input?.measurementDate || fallbackDateKey;
  return normalizeProfileDateKey(source, "");
}

export function buildProfileDatePayload(input = {}, fallbackDateKey = "", label = "profile request") {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const date = resolveProfilePayloadDateKey(input, fallbackDateKey);
  if (!date) throw new Error(`date is required for ${label}`);
  return {
    ...source,
    date
  };
}

export function buildHealthLogPayload(input = {}, fallbackDateKey = "") {
  const payload = buildProfileDatePayload(input, fallbackDateKey, "health log");
  const clean = { ...payload };
  delete clean.__silent;
  return {
    ...clean,
    log_date: clean.log_date || clean.date
  };
}

export function buildProgressMeasurementPayload(input = {}, fallbackDateKey = "") {
  const payload = buildProfileDatePayload(input, fallbackDateKey, "progress measurement");
  return {
    ...payload,
    measurement_date: payload.measurement_date || payload.date
  };
}

export function isProfileMutationResponseOk(result) {
  return Boolean(result) && result.ok !== false && result.success !== false && !result.error;
}

export function normalizeProfileRepositoryResult(result = {}) {
  return {
    result,
    profile: result?.profile || null,
    status: result?.status || result?.profile_status || null,
    accessDenied: Boolean(result?.access_denied)
  };
}

export function normalizeHealthRepositoryResult(result = {}, dateKey = "") {
  const healthLog = normalizeHealthLog(result.health_log || result.log || {}, dateKey);
  const remoteLogs = Array.isArray(result.health_logs)
    ? result.health_logs.map((log) => normalizeHealthLog(log, log.log_date || log.date))
    : [];
  const healthLogs = mergeHealthLogLists(remoteLogs, healthLog);
  return {
    result,
    healthLog,
    log: healthLog,
    healthLogs
  };
}

export function normalizeProgressRepositoryResult(result = {}, dateKey = "") {
  const profile = result?.profile || null;
  const rawMeasurement = result?.effective_measurement || result?.measurement || null;
  const measurement = rawMeasurement
    ? normalizeMeasurementValues(rawMeasurement, {}, profile || {})
    : null;
  const measurements = Array.isArray(result?.measurements)
    ? result.measurements.map((row) => normalizeMeasurementValues(row, {}, profile || {}))
    : [];

  return {
    result,
    profile,
    measurement,
    effectiveMeasurement: measurement,
    measurementDate: measurement ? getMeasurementDateKey(measurement) || dateKey : dateKey,
    measurements
  };
}

export function createProfileRepository({
  callProfileApi,
  dateKey = ""
} = {}) {
  const callApi = requireProfileApiCaller(callProfileApi);
  const call = (action, payload = {}) => callApi(action, payload);
  const updateProfileWithAction = async (input = {}, options = {}) => {
    const payload = {
      ...input,
      ...(options.dateKey || dateKey
        ? {
          current_date: input.current_date || normalizeProfileDateKey(options.dateKey || dateKey, options.dateKey || dateKey),
          measurement_date: input.measurement_date || normalizeProfileDateKey(options.dateKey || dateKey, options.dateKey || dateKey)
        }
        : {})
    };
    const action = options.action || PROFILE_REPOSITORY_ACTIONS.updateProfile;
    const result = await call(action, payload);
    return {
      payload,
      ...normalizeProfileRepositoryResult(result),
      confirmed: isProfileMutationResponseOk(result)
    };
  };

  return {
    call,

    async loadProfile(input = {}) {
      const payload = input && typeof input === "object" ? input : {};
      const result = await call(PROFILE_REPOSITORY_ACTIONS.loadProfile, payload);
      return {
        payload,
        ...normalizeProfileRepositoryResult(result)
      };
    },

    async updateProfile(input = {}, options = {}) {
      return updateProfileWithAction(input, options);
    },

    async completeOnboarding(input = {}, options = {}) {
      return updateProfileWithAction(input, { ...options, action: PROFILE_REPOSITORY_ACTIONS.completeOnboarding });
    },

    async resetProfile(input = {}) {
      const payload = input && typeof input === "object" ? input : {};
      const result = await call(PROFILE_REPOSITORY_ACTIONS.resetProfile, payload);
      return {
        payload,
        ...normalizeProfileRepositoryResult(result),
        confirmed: isProfileMutationResponseOk(result)
      };
    },

    async updateThemeSettings(input = {}) {
      const payload = input && typeof input === "object" ? input : {};
      const result = await call(PROFILE_REPOSITORY_ACTIONS.updateThemeSettings, payload);
      return {
        payload,
        ...normalizeProfileRepositoryResult(result),
        confirmed: isProfileMutationResponseOk(result)
      };
    },

    async updateAnalyticsCardSettings(input = {}) {
      const payload = input && typeof input === "object" ? input : {};
      const result = await call(PROFILE_REPOSITORY_ACTIONS.updateAnalyticsCardSettings, payload);
      return {
        payload,
        ...normalizeProfileRepositoryResult(result),
        confirmed: isProfileMutationResponseOk(result)
      };
    },

    async updateHomeState(input = {}) {
      const payload = input && typeof input === "object" ? input : {};
      const result = await call(PROFILE_REPOSITORY_ACTIONS.updateHomeState, payload);
      return {
        payload,
        ...normalizeProfileRepositoryResult(result),
        confirmed: isProfileMutationResponseOk(result)
      };
    },

    async updateTutorialState(input = {}) {
      const payload = input && typeof input === "object" ? input : {};
      const result = await call(PROFILE_REPOSITORY_ACTIONS.updateTutorialState, payload);
      return {
        payload,
        ...normalizeProfileRepositoryResult(result),
        confirmed: isProfileMutationResponseOk(result)
      };
    },

    async loadHealthLog(input = {}, options = {}) {
      const payload = buildProfileDatePayload(input, options.dateKey || dateKey, "load health log");
      const result = await call(PROFILE_REPOSITORY_ACTIONS.loadHealthLog, payload);
      return {
        payload,
        ...normalizeHealthRepositoryResult(result, payload.date)
      };
    },

    async saveHealthLog(input = {}, options = {}) {
      const payload = buildHealthLogPayload(input, options.dateKey || dateKey);
      const result = await call(PROFILE_REPOSITORY_ACTIONS.saveHealthLog, payload);
      return {
        payload,
        ...normalizeHealthRepositoryResult(result, payload.date),
        confirmed: isProfileMutationResponseOk(result)
      };
    },

    async loadProgress(input = {}, options = {}) {
      const payload = buildProfileDatePayload(input, options.dateKey || dateKey, "load progress");
      const result = await call(PROFILE_REPOSITORY_ACTIONS.loadProgress, payload);
      return {
        payload,
        ...normalizeProgressRepositoryResult(result, payload.date)
      };
    },

    async saveProgressMeasurement(input = {}, options = {}) {
      const payload = buildProgressMeasurementPayload(input, options.dateKey || dateKey);
      const result = await call(PROFILE_REPOSITORY_ACTIONS.saveProgressMeasurement, payload);
      return {
        payload,
        ...normalizeProgressRepositoryResult(result, payload.date),
        confirmed: isProfileMutationResponseOk(result)
      };
    },

    async loadMeasurementHistory(input = {}, options = {}) {
      const payload = buildProfileDatePayload(input, options.dateKey || dateKey, "load measurement history");
      const result = await call(PROFILE_REPOSITORY_ACTIONS.loadAnalytics, payload);
      return {
        payload,
        ...normalizeProgressRepositoryResult(result, payload.date)
      };
    }
  };
}
