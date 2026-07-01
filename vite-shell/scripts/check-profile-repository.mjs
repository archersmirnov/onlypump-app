import assert from "node:assert/strict";
import {
  buildHealthLogPayload,
  buildLocalHealthLog,
  buildProfileDatePayload,
  buildProgressMeasurementPayload,
  calculateRecoveryScore,
  calculateSleepDurationMinutes,
  createProfileRepository,
  getHealthLogDateKey,
  getMeasurementDataForDate,
  healthLogHasRealData,
  isProfileMutationResponseOk,
  measurementRecordHasRealData,
  mergeHealthLogLists,
  mergeMeasurementRecords,
  normalizeHealthLog,
  normalizeMeasurementValues,
  normalizeOptionalBoolean,
  normalizeProfileDateKey,
  PROFILE_REPOSITORY_ACTIONS,
  profileNonNegativeNumber,
  profileNumber,
  requireProfileApiCaller,
  resolveProfilePayloadDateKey
} from "../src/features/profile/index.js";

assert.equal(PROFILE_REPOSITORY_ACTIONS.loadProfile, "load_profile");
assert.equal(PROFILE_REPOSITORY_ACTIONS.updateProfile, "update_profile");
assert.equal(PROFILE_REPOSITORY_ACTIONS.completeOnboarding, "complete_onboarding");
assert.equal(PROFILE_REPOSITORY_ACTIONS.loadHealthLog, "load_health_log");
assert.equal(PROFILE_REPOSITORY_ACTIONS.saveHealthLog, "save_health_log");
assert.equal(PROFILE_REPOSITORY_ACTIONS.loadProgress, "load_progress");
assert.equal(PROFILE_REPOSITORY_ACTIONS.saveProgressMeasurement, "save_progress_measurement");
assert.throws(() => requireProfileApiCaller(null), /requires callProfileApi/);

assert.equal(normalizeProfileDateKey("2026-07-01T10:00:00Z"), "2026-07-01");
assert.equal(normalizeProfileDateKey("bad", "2026-07-02"), "2026-07-02");
assert.equal(profileNumber("72.5", 0), 72.5);
assert.equal(profileNumber("", 10), 10);
assert.equal(profileNonNegativeNumber(-5, 0), 0);
assert.equal(normalizeOptionalBoolean("да"), true);
assert.equal(normalizeOptionalBoolean("нет"), false);
assert.equal(normalizeOptionalBoolean(""), null);
assert.equal(calculateSleepDurationMinutes("2026-07-01T22:30:00", "2026-07-02T06:30:00"), 480);
assert.equal(calculateSleepDurationMinutes("2026-07-01T23:00:00", "2026-07-01T07:00:00"), 480);
assert.equal(calculateRecoveryScore({ sleep_duration_minutes: 480, sleep_latency_minutes: 10, sleep_awakenings: 1 }), 95);

const healthLog = normalizeHealthLog({
  log_date: "2026-07-01",
  steps_count: "12345",
  water_ml: "1800",
  sleep_started_at: "2026-07-01T23:00:00",
  sleep_ended_at: "2026-07-02T07:00:00",
  cardio: "yes",
  extra_activity: "no",
  measurements_done: "true",
  photo_done: "0",
  mood: "good",
  notes: "ok"
}, "2026-07-01");
assert.equal(healthLog.log_date, "2026-07-01");
assert.equal(healthLog.steps_count, 12345);
assert.equal(healthLog.sleep_duration_minutes, 480);
assert.equal(healthLog.cardio_completed, true);
assert.equal(healthLog.extra_activity_completed, false);
assert.equal(healthLog.measurements_done, true);
assert.equal(healthLog.photo_done, false);
assert.equal(healthLog.mood_key, "good");
assert.equal(healthLogHasRealData(healthLog), true);
assert.equal(getHealthLogDateKey(healthLog), "2026-07-01");
assert.equal(healthLogHasRealData(buildLocalHealthLog("2026-07-02")), false);
assert.deepEqual(mergeHealthLogLists(
  [{ log_date: "2026-07-01", steps_count: 1 }],
  [{ log_date: "2026-07-01", steps_count: 2 }],
  [{ log_date: "2026-07-02", steps_count: 3 }]
).map((log) => log.steps_count), [2, 3]);

assert.equal(resolveProfilePayloadDateKey({ measurement_date: "2026-07-03" }), "2026-07-03");
assert.deepEqual(buildProfileDatePayload({ date: "2026-07-01", foo: true }, "", "test"), {
  date: "2026-07-01",
  foo: true
});
assert.throws(() => buildProfileDatePayload({}, "", "test"), /date is required for test/);
assert.deepEqual(buildHealthLogPayload({ date: "2026-07-01", __silent: true, steps_count: 100 }), {
  date: "2026-07-01",
  steps_count: 100,
  log_date: "2026-07-01"
});
assert.deepEqual(buildProgressMeasurementPayload({ date: "2026-07-01", weight_kg: 90 }), {
  date: "2026-07-01",
  weight_kg: 90,
  measurement_date: "2026-07-01"
});

const measurement = normalizeMeasurementValues({
  measurement_date: "2026-07-01",
  weight_kg: "90",
  waist_cm: "84"
}, {}, { body_fat_percent: 15 });
assert.equal(measurement.weight, 90);
assert.equal(measurement.weight_kg, 90);
assert.equal(measurement.waist, 84);
assert.equal(measurement.bodyFat, 15);
assert.equal(measurement.measurement_date, "2026-07-01");
assert.equal(measurementRecordHasRealData(measurement), true);
assert.equal(measurementRecordHasRealData({ measurement_date: "2026-07-01" }), false);
assert.equal(getMeasurementDataForDate({
  dateKey: "2026-07-01",
  measurementRecords: [measurement]
}).weight, 90);
assert.deepEqual(mergeMeasurementRecords(
  { measurement_date: "2026-07-01", weight_kg: 80 },
  { measurement_date: "2026-07-01", weight_kg: 81 },
  { measurement_date: "2026-07-02", weight_kg: 82 }
).map((item) => item.weight), [81, 82]);

assert.equal(isProfileMutationResponseOk({ ok: true }), true);
assert.equal(isProfileMutationResponseOk({ success: false }), false);
assert.equal(isProfileMutationResponseOk({ error: "bad" }), false);

const calls = [];
const callProfileApi = async (action, payload) => {
  calls.push({ action, payload });
  if (action === "load_profile") {
    return { status: "verified", profile: { id: "profile-1", weight_kg: 90 } };
  }
  if (action === "load_health_log") {
    return {
      health_log: { log_date: payload.date, steps_count: 1000 },
      health_logs: [{ log_date: "2026-07-01", steps_count: 1000 }]
    };
  }
  if (action === "save_health_log") {
    return { ok: true, health_log: { log_date: payload.date, steps_count: payload.steps_count } };
  }
  if (action === "load_progress") {
    return {
      profile: { id: "profile-1", weight_kg: 90 },
      effective_measurement: { measurement_date: payload.date, weight_kg: 90, waist_cm: 84 }
    };
  }
  if (action === "save_progress_measurement") {
    return {
      ok: true,
      profile: { id: "profile-1", weight_kg: payload.weight_kg },
      measurement: { measurement_date: payload.measurement_date, weight_kg: payload.weight_kg }
    };
  }
  if (action === "load_analytics") {
    return {
      measurements: [
        { measurement_date: payload.start_date, weight_kg: 91 },
        { measurement_date: payload.end_date, weight_kg: 89 }
      ]
    };
  }
  return { ok: true, profile: { id: "profile-1", ...payload } };
};

const repository = createProfileRepository({ callProfileApi, dateKey: "2026-07-01" });

const loadedProfile = await repository.loadProfile();
assert.equal(calls[0].action, "load_profile");
assert.deepEqual(calls[0].payload, {});
assert.equal(loadedProfile.status, "verified");
assert.equal(loadedProfile.profile.id, "profile-1");

const updatedProfile = await repository.updateProfile({ display_name: "Artur" });
assert.equal(calls[1].action, "update_profile");
assert.equal(calls[1].payload.current_date, "2026-07-01");
assert.equal(calls[1].payload.measurement_date, "2026-07-01");
assert.equal(updatedProfile.confirmed, true);

const completedOnboarding = await repository.completeOnboarding({ sex: "male" });
assert.equal(calls[2].action, "complete_onboarding");
assert.equal(completedOnboarding.confirmed, true);

const loadedHealth = await repository.loadHealthLog();
assert.equal(calls[3].action, "load_health_log");
assert.deepEqual(calls[3].payload, { date: "2026-07-01" });
assert.equal(loadedHealth.healthLog.steps_count, 1000);
assert.equal(loadedHealth.healthLogs.length, 1);

const savedHealth = await repository.saveHealthLog({ steps_count: 2500, __silent: true });
assert.equal(calls[4].action, "save_health_log");
assert.deepEqual(calls[4].payload, { steps_count: 2500, date: "2026-07-01", log_date: "2026-07-01" });
assert.equal(savedHealth.confirmed, true);
assert.equal(savedHealth.healthLog.steps_count, 2500);

const loadedProgress = await repository.loadProgress();
assert.equal(calls[5].action, "load_progress");
assert.equal(loadedProgress.measurement.weight, 90);
assert.equal(loadedProgress.measurement.waist, 84);

const savedMeasurement = await repository.saveProgressMeasurement({ date: "2026-07-02", weight_kg: 88 });
assert.equal(calls[6].action, "save_progress_measurement");
assert.equal(calls[6].payload.measurement_date, "2026-07-02");
assert.equal(savedMeasurement.confirmed, true);
assert.equal(savedMeasurement.measurement.weight, 88);

const history = await repository.loadMeasurementHistory({
  date: "2026-07-03",
  start_date: "2026-01-01",
  end_date: "2026-07-03",
  scope: "overview",
  metric: "all"
});
assert.equal(calls[7].action, "load_analytics");
assert.equal(history.measurements.length, 2);
assert.deepEqual(history.measurements.map((item) => item.weight), [91, 89]);

const theme = await repository.updateThemeSettings({ light_theme_enabled: true });
assert.equal(calls[8].action, "update_theme_settings");
assert.equal(theme.confirmed, true);

const analyticsCards = await repository.updateAnalyticsCardSettings({ analytics_cards_order: ["weight"] });
assert.equal(calls[9].action, "update_analytics_card_settings");
assert.equal(analyticsCards.confirmed, true);

const homeState = await repository.updateHomeState({ home_widgets_order: ["nutrition"] });
assert.equal(calls[10].action, "update_home_state");
assert.equal(homeState.confirmed, true);

const tutorial = await repository.updateTutorialState({ tutorial_completed_screens: ["home"] });
assert.equal(calls[11].action, "update_tutorial_state");
assert.equal(tutorial.confirmed, true);

const reset = await repository.resetProfile();
assert.equal(calls[12].action, "reset_profile");
assert.equal(reset.confirmed, true);

console.log("profile repository checks passed");
