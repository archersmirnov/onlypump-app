export const HOME_LAYOUT_MOBILE = "mobile";
export const HOME_LAYOUT_DESKTOP = "desktop";

export const PERSONAL_TRACKER_WIDGET_ID = "personalTracker";
export const PERSONAL_TRACKER_WIDGET_PREFIX = "tracker:";

export const HOME_WIDGET_CATALOG = [
  { id: "metricWeight", label: "Вес", description: "Текущий вес и изменение", default: true, size: "1x2" },
  { id: "metricBodyFat", label: "Процент жира", description: "Оценка процента жира", default: true, size: "1x2" },
  { id: "metricTonnage", label: "Тоннаж", description: "Выполненный тоннаж тренировки", default: true, size: "1x2" },
  { id: "metricSets", label: "Подходы", description: "Выполненные подходы", default: true, size: "1x2" },
  { id: "metricCalories", label: "Калории", description: "Калории за день", default: true, size: "1x2" },
  { id: "metricProtein", label: "Белок", description: "Белок за день", default: true, size: "1x2" },
  { id: "metricRecovery", label: "Восстановление", description: "Индекс восстановления", default: true, size: "1x2" },
  { id: "metricSleep", label: "Сон", description: "Отчет сна и восстановление", default: false, size: "1x2" },
  { id: "metricSteps", label: "Шаги", description: "Шаги за выбранный день", default: false, size: "1x2" },
  { id: "macros", label: "БЖУ", description: "Белки, жиры и углеводы со шкалами", default: false, size: "2x2" },
  { id: "water", label: "Вода", description: "Трекер выпитой воды за день", default: false, size: "4x1" },
  { id: "personalTracker", label: "Трекер", description: "Персональный трекер жидкости, еды, привычки или отказа", default: false, size: "2x2" },
  { id: "moodWellbeing", label: "Настроение и самочувствие", description: "Два показателя за выбранный день", default: false, size: "2x2" },
  { id: "dailyNote", label: "Заметки", description: "Заметка по выбранному дню", default: false, size: "2x2" },
  { id: "workout", label: "Сегодняшняя тренировка", description: "План и прогресс тренировки дня", default: false, size: "4x2" },
  { id: "nutrition", label: "Питание на сегодня", description: "Калории и кольцо прогресса", default: false, size: "4x2" },
  { id: "energyExpenditure", label: "Расход энергии", description: "TDEE, BMR, TEF, NEAT и EAT за день", default: false, size: "4x2" },
  { id: "weekProgress", label: "Прогресс недели", description: "График выполнения плана", default: false, size: "4x2" },
  { id: "goalProgress", label: "Прогресс к цели", description: "Процент достижения цели", default: false, size: "2x2" },
  { id: "miniActions", label: "Быстрые действия", description: "Тренировка, лекция и план", default: false, size: "2x4" },
  { id: "education", label: "Обучение", description: "Лекции для продолжения", default: false, size: "4x2" },
  { id: "tools", label: "Инструменты", description: "Калькуляторы ONLYPUMP", default: false, size: "4x2" },
];

export const DEFAULT_HOME_WIDGETS = HOME_WIDGET_CATALOG
  .filter((widget) => widget.default)
  .map((widget) => widget.id);

export const NUTRITION_HOME_WIDGET_IDS = ["metricCalories", "metricProtein", "macros", "nutrition"];

export const HOME_WIDGET_SIZE_ALIASES = {
  compact: "1x2",
  "1x2": "1x2",
  square: "2x2",
  "2x2": "2x2",
  tall: "2x4",
  "2x4": "2x4",
  wide: "4x2",
  full: "4x2",
  large: "4x2",
  "4x2": "4x2",
  "4x1": "4x1",
};

export const HOME_WIDGET_SIZE_CLASSES = {
  "1x2": "home-widget-card--compact",
  "2x2": "home-widget-card--square",
  "2x4": "home-widget-card--tall",
  "4x2": "home-widget-card--wide",
  "4x1": "home-widget-card--banner",
};

export const HOME_WIDGET_READ_MODEL_DEFINITIONS = {
  metricWeight: {
    unit: "кг",
    fractionDigits: 1,
    metaLabel: "текущий замер",
    paths: [
      ["measurement", "weight"],
      ["measurement", "weight_kg"],
      ["measurements", "weight"],
      ["profile", "weight"],
      ["profile", "weight_kg"],
      ["profile", "weightKg"],
    ],
  },
  metricBodyFat: {
    unit: "%",
    fractionDigits: 1,
    metaLabel: "оценка состава",
    paths: [
      ["measurement", "bodyFat"],
      ["measurement", "body_fat_percent"],
      ["measurements", "bodyFat"],
      ["measurements", "body_fat_percent"],
      ["profile", "bodyFat"],
      ["profile", "body_fat_percent"],
    ],
  },
  metricTonnage: {
    unit: "кг",
    fractionDigits: 0,
    metaLabel: "неделя",
    paths: [
      ["training", "totalVolume"],
      ["training", "total_volume"],
      ["training", "weekVolume"],
      ["workouts", "totalVolume"],
      ["workoutSummary", "totalVolume"],
      ["workoutSummary", "total_volume"],
      ["weekSummary", "totalVolume"],
    ],
  },
  metricSets: {
    unit: "подходов",
    fractionDigits: 0,
    metaLabel: "неделя",
    paths: [
      ["training", "completedSets"],
      ["training", "totalSets"],
      ["training", "total_sets"],
      ["workouts", "completedSets"],
      ["workoutSummary", "completedSets"],
      ["workoutSummary", "totalSets"],
      ["weekSummary", "completedSets"],
      ["weekSummary", "totalSets"],
    ],
  },
  metricCalories: {
    unit: "ккал",
    fractionDigits: 0,
    metaLabel: "сегодня",
    paths: [
      ["nutrition", "calories"],
      ["nutrition", "calories_total"],
      ["nutrition", "totals", "calories"],
      ["nutritionSummary", "calories"],
      ["nutritionSummary", "totals", "calories"],
    ],
  },
  metricProtein: {
    unit: "г",
    fractionDigits: 0,
    metaLabel: "белок сегодня",
    paths: [
      ["nutrition", "protein"],
      ["nutrition", "protein_total"],
      ["nutrition", "totals", "protein"],
      ["nutritionSummary", "protein"],
      ["nutritionSummary", "totals", "protein"],
    ],
  },
  metricRecovery: {
    unit: "%",
    fractionDigits: 0,
    metaLabel: "индекс",
    paths: [
      ["health", "recoveryScore"],
      ["health", "recovery_score"],
      ["healthSummary", "recoveryScore"],
      ["healthSummary", "recovery_score"],
      ["recovery", "score"],
    ],
  },
  metricSleep: {
    metaLabel: "последняя ночь",
    paths: [
      ["health", "sleepMinutes"],
      ["health", "sleep_minutes"],
      ["health", "sleep_duration_minutes"],
      ["healthSummary", "sleepMinutes"],
      ["healthSummary", "sleep_duration_minutes"],
    ],
    formatValue: formatHomeSleepMinutes,
  },
  metricSteps: {
    unit: "шагов",
    fractionDigits: 0,
    metaLabel: "сегодня",
    paths: [
      ["health", "steps"],
      ["health", "steps_count"],
      ["healthSummary", "steps"],
      ["activity", "steps"],
    ],
  },
};

function normalizeWidgetArrayValue(value, fallback = null) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

export function isPersonalTrackerWidgetId(id = "") {
  return String(id).startsWith(PERSONAL_TRACKER_WIDGET_PREFIX);
}

export function personalTrackerWidgetId(trackerId = "") {
  return `${PERSONAL_TRACKER_WIDGET_PREFIX}${trackerId}`;
}

export function personalTrackerIdFromWidget(widgetId = "") {
  return String(widgetId).slice(PERSONAL_TRACKER_WIDGET_PREFIX.length);
}

export function normalizeHomeWidgetSize(size = "2x2") {
  return HOME_WIDGET_SIZE_ALIASES[String(size || "").trim()] || "2x2";
}

export function getHomeWidgetById(id = "") {
  return HOME_WIDGET_CATALOG.find((widget) => widget.id === id) || null;
}

export function getHomeCatalogWidgetSize(id = "") {
  const item = getHomeWidgetById(id);
  if (!item) return "1x2";
  if (item.size) return normalizeHomeWidgetSize(item.size);
  if (item.span === "full" || item.span === "large") return "4x2";
  return "1x2";
}

export function getHomeWidgetSizeClass(id = "") {
  return HOME_WIDGET_SIZE_CLASSES[getHomeCatalogWidgetSize(id)] || HOME_WIDGET_SIZE_CLASSES["2x2"];
}

export function isCompactHomeWidget(id = "") {
  return !isPersonalTrackerWidgetId(id) && getHomeCatalogWidgetSize(id) === "1x2";
}

export function isWidgetCompactForInsert(id = "") {
  return isPersonalTrackerWidgetId(id) || isCompactHomeWidget(id);
}

export function enforceHomeWidgetRules(widgets = []) {
  const unique = [];
  widgets.forEach((id) => {
    if (id === PERSONAL_TRACKER_WIDGET_ID) return;
    if (!unique.includes(id)) unique.push(id);
  });

  const withoutNutritionGroup = unique.filter((id) => !NUTRITION_HOME_WIDGET_IDS.includes(id));
  const insertAtFirstNutritionPosition = (items) => {
    const cleanItems = items.filter((item, index) => items.indexOf(item) === index);
    const firstNutritionIndex = unique.findIndex((id) => NUTRITION_HOME_WIDGET_IDS.includes(id));
    if (firstNutritionIndex === -1) return [...withoutNutritionGroup, ...cleanItems];

    const before = unique
      .slice(0, firstNutritionIndex)
      .filter((id) => !NUTRITION_HOME_WIDGET_IDS.includes(id));
    const after = unique
      .slice(firstNutritionIndex)
      .filter((id) => !NUTRITION_HOME_WIDGET_IDS.includes(id));
    return [...before, ...cleanItems, ...after];
  };

  if (unique.includes("nutrition")) return insertAtFirstNutritionPosition(["nutrition"]);
  if (unique.includes("macros")) return insertAtFirstNutritionPosition(["macros"]);

  const compactNutritionWidgets = unique.filter((id) => id === "metricCalories" || id === "metricProtein");
  if (compactNutritionWidgets.length) return insertAtFirstNutritionPosition(compactNutritionWidgets);

  return unique;
}

export function buildHomeWidgetsAfterAdding(prevWidgets, id) {
  if (isPersonalTrackerWidgetId(id)) {
    if (prevWidgets.includes(id)) return enforceHomeWidgetRules(prevWidgets);
    const firstLargeIndex = prevWidgets.findIndex((widgetId) => !isWidgetCompactForInsert(widgetId));
    const next = firstLargeIndex === -1
      ? [...prevWidgets, id]
      : [...prevWidgets.slice(0, firstLargeIndex), id, ...prevWidgets.slice(firstLargeIndex)];
    return enforceHomeWidgetRules(next);
  }

  const insertCompact = (baseWidgets, items) => {
    const cleanItems = items.filter((item, index) => items.indexOf(item) === index);
    const compactInsertIndex = baseWidgets.findIndex((widgetId) => !isWidgetCompactForInsert(widgetId));
    if (compactInsertIndex === -1) return [...baseWidgets, ...cleanItems];
    return [
      ...baseWidgets.slice(0, compactInsertIndex),
      ...cleanItems,
      ...baseWidgets.slice(compactInsertIndex),
    ];
  };

  if (id === "nutrition" || id === "macros") {
    const withoutNutritionGroup = prevWidgets.filter((widgetId) => !NUTRITION_HOME_WIDGET_IDS.includes(widgetId));
    return enforceHomeWidgetRules(insertCompact(withoutNutritionGroup, [id]));
  }

  if (id === "metricProtein" || id === "metricCalories") {
    const withoutExclusiveNutrition = prevWidgets
      .filter((widgetId) => widgetId !== "nutrition" && widgetId !== "macros" && widgetId !== id);
    return enforceHomeWidgetRules(insertCompact(withoutExclusiveNutrition, [id]));
  }

  if (prevWidgets.includes(id)) return enforceHomeWidgetRules(prevWidgets);

  if (isCompactHomeWidget(id)) {
    const firstLargeIndex = prevWidgets.findIndex((widgetId) => !isWidgetCompactForInsert(widgetId));
    const next = firstLargeIndex === -1
      ? [...prevWidgets, id]
      : [...prevWidgets.slice(0, firstLargeIndex), id, ...prevWidgets.slice(firstLargeIndex)];
    return enforceHomeWidgetRules(next);
  }

  return enforceHomeWidgetRules([...prevWidgets, id]);
}

export function buildHomeWidgetsAfterRemoving(prevWidgets, id) {
  return enforceHomeWidgetRules(prevWidgets.filter((widgetId) => widgetId !== id));
}

export function normalizeHomeWidgetsOrder(value, fallback = DEFAULT_HOME_WIDGETS) {
  const source = normalizeWidgetArrayValue(value, null);
  const validIds = HOME_WIDGET_CATALOG.map((widget) => widget.id);
  const base = Array.isArray(source) ? source : fallback;
  if (!Array.isArray(base)) return enforceHomeWidgetRules(DEFAULT_HOME_WIDGETS);

  const cleaned = base.filter((id) => validIds.includes(id) || isPersonalTrackerWidgetId(id));
  return enforceHomeWidgetRules(cleaned);
}

export function parseHomeWidgetsStorageValue(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return fallback;
    }
  }
  return value;
}

export function normalizeHomeWidgetsStorageValue(value, fallback = DEFAULT_HOME_WIDGETS) {
  const parsed = parseHomeWidgetsStorageValue(value, null);
  const fallbackParsed = parseHomeWidgetsStorageValue(fallback, DEFAULT_HOME_WIDGETS);
  const fallbackMobile = Array.isArray(fallbackParsed)
    ? fallbackParsed
    : (fallbackParsed?.mobile || DEFAULT_HOME_WIDGETS);
  const fallbackDesktop = Array.isArray(fallbackParsed)
    ? fallbackParsed
    : (fallbackParsed?.desktop || fallbackMobile || DEFAULT_HOME_WIDGETS);

  if (Array.isArray(parsed)) {
    const normalized = normalizeHomeWidgetsOrder(parsed, DEFAULT_HOME_WIDGETS);
    return { mobile: normalized, desktop: normalized };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return {
      mobile: normalizeHomeWidgetsOrder(parsed.mobile, fallbackMobile),
      desktop: normalizeHomeWidgetsOrder(parsed.desktop, fallbackDesktop),
    };
  }

  return {
    mobile: normalizeHomeWidgetsOrder(fallbackMobile, DEFAULT_HOME_WIDGETS),
    desktop: normalizeHomeWidgetsOrder(fallbackDesktop, DEFAULT_HOME_WIDGETS),
  };
}

export function homeWidgetsForLayout(value, layoutMode = HOME_LAYOUT_MOBILE, fallback = DEFAULT_HOME_WIDGETS) {
  const normalized = normalizeHomeWidgetsStorageValue(value, fallback);
  return normalizeHomeWidgetsOrder(normalized[layoutMode] || normalized.mobile || DEFAULT_HOME_WIDGETS, DEFAULT_HOME_WIDGETS);
}

export function homeWidgetsStorageWithLayout(value, layoutMode = HOME_LAYOUT_MOBILE, widgets = []) {
  const normalized = normalizeHomeWidgetsStorageValue(value, DEFAULT_HOME_WIDGETS);
  return {
    ...normalized,
    [layoutMode]: normalizeHomeWidgetsOrder(widgets, DEFAULT_HOME_WIDGETS),
  };
}

export function getHomeWidgetsCacheKey(profile = {}) {
  return `onlypump_home_widgets_${profile?.telegram_id || profile?.id || "local"}`;
}

function getBrowserStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function readCachedHomeWidgetsForProfile(profile = {}, options = {}) {
  const layoutMode = options.layoutMode || HOME_LAYOUT_MOBILE;
  const storage = options.storage || getBrowserStorage();
  if (!storage) return enforceHomeWidgetRules(DEFAULT_HOME_WIDGETS);

  try {
    const profileKey = getHomeWidgetsCacheKey(profile);
    const saved = storage.getItem(profileKey) || storage.getItem("onlypump-home-widgets");
    if (!saved) return enforceHomeWidgetRules(DEFAULT_HOME_WIDGETS);
    return homeWidgetsForLayout(JSON.parse(saved), layoutMode, DEFAULT_HOME_WIDGETS);
  } catch (error) {
    return enforceHomeWidgetRules(DEFAULT_HOME_WIDGETS);
  }
}

export function writeCachedHomeWidgetsForProfile(profile = {}, widgets = [], options = {}) {
  const layoutMode = options.layoutMode || HOME_LAYOUT_MOBILE;
  const storage = options.storage || getBrowserStorage();
  if (!storage) return null;

  try {
    const profileKey = getHomeWidgetsCacheKey(profile);
    const previous = storage.getItem(profileKey) || storage.getItem("onlypump-home-widgets");
    const normalized = homeWidgetsStorageWithLayout(
      previous ? JSON.parse(previous) : profile?.home_widgets_order,
      layoutMode,
      widgets
    );
    storage.setItem(profileKey, JSON.stringify(normalized));
    storage.setItem("onlypump-home-widgets", JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    return null;
  }
}

function getHomeDataByPath(source, path = []) {
  return path.reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    return current[key];
  }, source);
}

function normalizeHomeDataValue(rawValue) {
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return {
      value: rawValue.value ?? rawValue.current ?? rawValue.total ?? null,
      valueLabel: rawValue.valueLabel || rawValue.label || "",
      metaLabel: rawValue.metaLabel || rawValue.meta || "",
    };
  }

  return { value: rawValue, valueLabel: "", metaLabel: "" };
}

function getHomeWidgetRawData(widgetId, source = {}, paths = []) {
  const candidates = [
    ["metrics", widgetId],
    ["values", widgetId],
    [widgetId],
    ...paths,
  ];

  for (const path of candidates) {
    const rawValue = getHomeDataByPath(source, path);
    if (rawValue !== null && rawValue !== undefined && rawValue !== "") {
      return normalizeHomeDataValue(rawValue);
    }
  }

  return normalizeHomeDataValue(null);
}

function formatHomeNumber(value, fractionDigits = 0) {
  if (value === null || value === undefined || value === "") return "";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  if (fractionDigits <= 0) return String(Math.round(numericValue));
  return numericValue.toFixed(fractionDigits).replace(/\.0+$/, "");
}

function formatHomeMetricValue(value, definition = {}) {
  if (typeof definition.formatValue === "function") return definition.formatValue(value);

  const numberLabel = formatHomeNumber(value, definition.fractionDigits || 0);
  if (!numberLabel) return "";
  return definition.unit ? `${numberLabel} ${definition.unit}` : numberLabel;
}

function formatHomeSleepMinutes(value) {
  if (value === null || value === undefined || value === "") return "";
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return "";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (!hours) return `${remainingMinutes} мин`;
  if (!remainingMinutes) return `${hours} ч`;
  return `${hours} ч ${remainingMinutes} мин`;
}

export function buildHomeWidgetValueModel(widgetId = "", source = {}) {
  const definition = HOME_WIDGET_READ_MODEL_DEFINITIONS[widgetId];
  if (!definition) return { hasValue: false, value: null, valueLabel: "", metaLabel: "" };

  const rawData = getHomeWidgetRawData(widgetId, source, definition.paths || []);
  const valueLabel = rawData.valueLabel || formatHomeMetricValue(rawData.value, definition);

  return {
    hasValue: Boolean(valueLabel),
    value: rawData.value ?? null,
    valueLabel,
    metaLabel: rawData.metaLabel || definition.metaLabel || "",
  };
}

export function buildHomeWidgetPreviewItems(widgets = DEFAULT_HOME_WIDGETS) {
  return normalizeHomeWidgetsOrder(widgets).map((id) => {
    const catalogItem = getHomeWidgetById(id);
    return {
      id,
      label: catalogItem?.label || (isPersonalTrackerWidgetId(id) ? "Трекер" : id),
      description: catalogItem?.description || "Пользовательский виджет",
      size: getHomeCatalogWidgetSize(id),
      sizeClass: getHomeWidgetSizeClass(id),
      personalTrackerId: isPersonalTrackerWidgetId(id) ? personalTrackerIdFromWidget(id) : "",
    };
  });
}

export function buildHomeWidgetsViewModel(source = {}, options = {}) {
  const widgets = normalizeHomeWidgetsOrder(options.widgets || source?.widgets || DEFAULT_HOME_WIDGETS);
  const items = buildHomeWidgetPreviewItems(widgets).map((item) => ({
    ...item,
    ...buildHomeWidgetValueModel(item.id, source),
  }));

  return {
    items,
    widgets,
    visibleCount: items.length,
    catalogCount: HOME_WIDGET_CATALOG.length,
    hasReadOnlyData: items.some((item) => item.hasValue),
    selectedDateKey: source?.selectedDateKey || source?.dateKey || "",
  };
}
