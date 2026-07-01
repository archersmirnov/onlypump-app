export const DEFAULT_HEALTH_LOG = Object.freeze({
  id: null,
  date: "",
  log_date: "",
  steps_count: 0,
  sleep_started_at: null,
  sleep_ended_at: null,
  sleep_duration_minutes: 0,
  sleep_latency_minutes: 0,
  sleep_awakenings: 0,
  sleep_quality_score: null,
  recovery_score: null,
  water_ml: 0,
  water_target_ml: 2500,
  mood_key: "",
  wellbeing_key: "",
  cardio_completed: null,
  extra_activity_completed: null,
  measurements_done: null,
  photo_done: null,
  tdee_kcal: 0,
  bmr_kcal: 0,
  tef_kcal: 0,
  neat_kcal: 0,
  eat_kcal: 0,
  bmr_percent: 0,
  tef_percent: 0,
  neat_percent: 0,
  eat_percent: 0,
  tef_needs_review: false,
  neat_needs_review: false,
  eat_needs_review: false,
  tdee_formula_version: "",
  notes: ""
});

export const MEASUREMENT_FIELDS = Object.freeze([
  { field: "weight", db: "weight_kg" },
  { field: "bodyFat", db: "body_fat_percent" },
  { field: "neck", db: "neck_cm" },
  { field: "shoulders", db: "shoulders_cm" },
  { field: "chest", db: "chest_cm" },
  { field: "biceps", db: "biceps_cm" },
  { field: "waist", db: "waist_cm" },
  { field: "belly", db: "abdomen_cm" },
  { field: "glutes", db: "glutes_cm" },
  { field: "thigh", db: "thigh_cm" },
  { field: "calf", db: "calf_cm" }
]);

export function normalizeProfileDateKey(value, fallback = "") {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : fallback;
}

export function profileNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function profileNonNegativeNumber(value, fallback = 0) {
  return Math.max(0, profileNumber(value, fallback));
}

export function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value === true || value === "true" || value === 1 || value === "1" || value === "yes" || value === "да") return true;
  if (value === false || value === "false" || value === 0 || value === "0" || value === "no" || value === "нет") return false;
  return Boolean(value);
}

export function clampProfileNumber(value, min = 0, max = Infinity) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

export function calculateSleepDurationMinutes(startValue, endValue, fallback = 0) {
  const start = new Date(startValue || "");
  const end = new Date(endValue || "");
  const fallbackNumber = Number(fallback);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Number.isFinite(fallbackNumber) ? Math.max(0, fallbackNumber) : 0;
  }
  let diff = Math.round((end.getTime() - start.getTime()) / 60000);
  if (diff < 0) diff += 24 * 60;
  return clampProfileNumber(diff, 0, 24 * 60);
}

export function calculateRecoveryScore(log = {}) {
  const duration = Number(log.sleep_duration_minutes || 0);
  if (!duration) return null;
  const latency = Number(log.sleep_latency_minutes || 0);
  const awakenings = Number(log.sleep_awakenings || 0);
  const sleepScore = Math.min(duration / 480, 1) * 100;
  const latencyPenalty = latency <= 20 ? 0 : clampProfileNumber((latency - 20) / 4, 5, 15);
  const awakeningsPenalty = awakenings * 5;
  return Math.round(clampProfileNumber(sleepScore - latencyPenalty - awakeningsPenalty, 0, 100));
}

export function getHealthLogDateKey(log = {}) {
  return normalizeProfileDateKey(log?.log_date || log?.date, "");
}

export function normalizeHealthLog(record = {}, dateKey = "") {
  const logDate = normalizeProfileDateKey(record?.log_date || record?.date, dateKey);
  const duration = calculateSleepDurationMinutes(
    record.sleep_started_at,
    record.sleep_ended_at,
    record.sleep_duration_minutes
  );
  const base = {
    ...DEFAULT_HEALTH_LOG,
    ...record,
    date: logDate,
    log_date: logDate,
    steps_count: profileNonNegativeNumber(record.steps_count, 0),
    water_ml: profileNonNegativeNumber(record.water_ml, DEFAULT_HEALTH_LOG.water_ml),
    water_target_ml: profileNonNegativeNumber(record.water_target_ml, DEFAULT_HEALTH_LOG.water_target_ml),
    mood_key: String(record.mood_key || record.mood || ""),
    wellbeing_key: String(record.wellbeing_key || record.wellbeing || ""),
    cardio_completed: normalizeOptionalBoolean(record.cardio_completed ?? record.cardio),
    extra_activity_completed: normalizeOptionalBoolean(record.extra_activity_completed ?? record.extra_activity),
    measurements_done: normalizeOptionalBoolean(record.measurements_done),
    photo_done: normalizeOptionalBoolean(record.photo_done),
    tdee_kcal: profileNonNegativeNumber(record.tdee_kcal, 0),
    bmr_kcal: profileNonNegativeNumber(record.bmr_kcal, 0),
    tef_kcal: profileNonNegativeNumber(record.tef_kcal, 0),
    neat_kcal: profileNonNegativeNumber(record.neat_kcal, 0),
    eat_kcal: profileNonNegativeNumber(record.eat_kcal, 0),
    bmr_percent: profileNonNegativeNumber(record.bmr_percent, 0),
    tef_percent: profileNonNegativeNumber(record.tef_percent, 0),
    neat_percent: profileNonNegativeNumber(record.neat_percent, 0),
    eat_percent: profileNonNegativeNumber(record.eat_percent, 0),
    tef_needs_review: Boolean(normalizeOptionalBoolean(record.tef_needs_review)),
    neat_needs_review: Boolean(normalizeOptionalBoolean(record.neat_needs_review)),
    eat_needs_review: Boolean(normalizeOptionalBoolean(record.eat_needs_review)),
    tdee_formula_version: String(record.tdee_formula_version || ""),
    notes: String(record.notes || ""),
    sleep_duration_minutes: duration,
    sleep_latency_minutes: profileNonNegativeNumber(record.sleep_latency_minutes, 0),
    sleep_awakenings: profileNonNegativeNumber(record.sleep_awakenings, 0)
  };

  return {
    ...base,
    recovery_score: record.recovery_score ?? calculateRecoveryScore(base)
  };
}

export function buildLocalHealthLog(dateKey = "") {
  return normalizeHealthLog({ date: dateKey, log_date: dateKey }, dateKey);
}

export function healthLogHasRealData(log = {}) {
  if (!log) return false;
  return profileNonNegativeNumber(log.steps_count, 0) > 0 ||
    profileNonNegativeNumber(log.water_ml, 0) > 0 ||
    profileNonNegativeNumber(log.sleep_duration_minutes, 0) > 0 ||
    Boolean(log.sleep_started_at || log.sleep_ended_at) ||
    (log.recovery_score !== null && log.recovery_score !== undefined) ||
    String(log.mood_key || log.mood || "").trim().length > 0 ||
    String(log.wellbeing_key || log.wellbeing || "").trim().length > 0 ||
    log.cardio_completed === true ||
    log.extra_activity_completed === true ||
    log.measurements_done === true ||
    log.photo_done === true ||
    String(log.notes || "").trim().length > 0;
}

export function mergeHealthLogLists(...sources) {
  const byDate = new Map();
  sources.flat().filter(Boolean).forEach((log) => {
    const normalized = normalizeHealthLog(log, log?.log_date || log?.date);
    const key = normalized.log_date || normalized.date;
    if (key) byDate.set(key, normalized);
  });
  return Array.from(byDate.values()).sort((a, b) =>
    String(a.log_date || a.date).localeCompare(String(b.log_date || b.date))
  );
}

export function getMeasurementDateKey(item = {}) {
  return normalizeProfileDateKey(item?.measurement_date || item?.date, "");
}

export function measurementRecordHasRealData(record = {}) {
  return MEASUREMENT_FIELDS.some((item) =>
    profileNumber(record?.[item.db] ?? record?.[item.field], 0) > 0
  );
}

export function normalizeMeasurementValues(record = {}, fallback = {}, profile = {}) {
  const normalized = { ...(fallback || {}) };
  MEASUREMENT_FIELDS.forEach((item) => {
    const raw = record?.[item.db] ??
      record?.[item.field] ??
      fallback?.[item.field] ??
      fallback?.[item.db] ??
      profile?.[item.db];
    const value = profileNumber(raw, null);
    if (value !== null) {
      normalized[item.field] = value;
      normalized[item.db] = value;
    } else if (normalized[item.field] === undefined) {
      normalized[item.field] = "";
    }
  });
  const dateKey = getMeasurementDateKey(record) || getMeasurementDateKey(fallback);
  if (dateKey) {
    normalized.date = dateKey;
    normalized.measurement_date = dateKey;
  }
  return normalized;
}

export function buildMeasurementByDate({
  measurements = {},
  measurementRecords = [],
  profile = {}
} = {}) {
  const byDate = new Map();
  const addMeasurement = (rawMeasurement, fallbackDate = "", fallback = {}) => {
    const dateKey = getMeasurementDateKey(rawMeasurement) || normalizeProfileDateKey(fallbackDate, "");
    if (!rawMeasurement || !dateKey || !measurementRecordHasRealData(rawMeasurement)) return;
    byDate.set(dateKey, normalizeMeasurementValues(rawMeasurement, fallback, profile));
  };

  (Array.isArray(measurementRecords) ? measurementRecords : []).forEach((row) => addMeasurement(row));
  if (measurements && Object.keys(measurements).length) {
    const explicitDate = getMeasurementDateKey(measurements);
    if (explicitDate) addMeasurement(measurements, explicitDate);
  }

  return byDate;
}

export function getMeasurementDataForDate({
  dateKey = "",
  measurementByDate = null,
  measurements = {},
  measurementRecords = [],
  profile = {}
} = {}) {
  const safeDateKey = normalizeProfileDateKey(dateKey, "");
  const source = measurementByDate instanceof Map
    ? measurementByDate
    : buildMeasurementByDate({ measurements, measurementRecords, profile });
  const fallback = normalizeMeasurementValues(measurements, {}, profile);
  return source.get(safeDateKey) ||
    normalizeMeasurementValues({ date: safeDateKey, measurement_date: safeDateKey }, fallback, profile);
}

export function mergeMeasurementRecords(...sources) {
  const byDate = new Map();
  sources.flat().filter(Boolean).forEach((record) => {
    const normalized = normalizeMeasurementValues(record, {}, {});
    const key = getMeasurementDateKey(normalized);
    if (key && measurementRecordHasRealData(normalized)) byDate.set(key, normalized);
  });
  return Array.from(byDate.values()).sort((a, b) =>
    String(a.measurement_date || a.date).localeCompare(String(b.measurement_date || b.date))
  );
}
