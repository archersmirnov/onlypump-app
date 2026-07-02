import {
  ANALYTICS_PERIODS,
  analyticsSummary,
  buildHealthSeries,
  buildMeasurementSeries,
  buildNutritionSeries,
  buildTrainingSeries,
  filterRollingAnalyticsPoints,
  getAnalyticsChartRollingRange,
  getAnalyticsChartSvgWidth,
  isLongAnalyticsChartPeriod,
  normalizeAnalyticsPeriod,
  parseAnalyticsDateKeyLocal,
  shiftAnalyticsChartDivisionDate
} from "./analyticsData.js";

export const ANALYTICS_CHART_DEFINITIONS = Object.freeze([
  {
    key: "weight",
    title: "Вес",
    source: "measurements",
    metricKey: "weight_kg",
    unit: "кг",
    tone: "red"
  },
  {
    key: "steps",
    title: "Шаги",
    source: "health",
    metricKey: "steps_count",
    unit: "шагов",
    tone: "green"
  },
  {
    key: "calories",
    title: "Калории",
    source: "nutrition",
    metricKey: "calories_total",
    unit: "ккал",
    tone: "amber"
  },
  {
    key: "trainingVolume",
    title: "Тоннаж",
    source: "training",
    metricKey: "volume",
    unit: "кг",
    tone: "blue"
  }
]);

const CHART_HEIGHT = 160;
const CHART_PADDING = Object.freeze({ top: 16, right: 16, bottom: 24, left: 34 });
const SHORT_MONTH_LABELS_RU = Object.freeze(["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]);

export const ANALYTICS_CHART_PERIOD_OPTIONS = Object.freeze([
  ANALYTICS_PERIODS.week,
  ANALYTICS_PERIODS.month,
  ANALYTICS_PERIODS.sixMonths,
  ANALYTICS_PERIODS.year
]);

export const ANALYTICS_CHART_PERIOD_LABELS = Object.freeze({
  [ANALYTICS_PERIODS.day]: "День",
  [ANALYTICS_PERIODS.week]: "Неделя",
  [ANALYTICS_PERIODS.month]: "Месяц",
  [ANALYTICS_PERIODS.sixMonths]: "6 месяцев",
  [ANALYTICS_PERIODS.year]: "Год"
});

export function formatAnalyticsChartValue(value = 0, unit = "") {
  const numericValue = Number(value || 0);
  const rounded = Math.round(numericValue * 10) / 10;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatAnalyticsChartDateLabel(dateKey = "", period = ANALYTICS_PERIODS.month) {
  const date = parseAnalyticsDateKeyLocal(dateKey);
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  if (normalizedPeriod === ANALYTICS_PERIODS.year || normalizedPeriod === ANALYTICS_PERIODS.sixMonths) {
    return SHORT_MONTH_LABELS_RU[date.getMonth()] || "";
  }
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function formatAnalyticsChartRangeDate(dateKey = "", includeYear = false) {
  const date = parseAnalyticsDateKeyLocal(dateKey);
  const day = String(date.getDate()).padStart(2, "0");
  const month = SHORT_MONTH_LABELS_RU[date.getMonth()] || "";
  return includeYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

export function formatAnalyticsChartRangeLabel(range = {}, period = ANALYTICS_PERIODS.month) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const startKey = range.startKey || "";
  const endKey = range.endKey || "";
  if (!startKey || !endKey) return "";
  if (startKey === endKey) return formatAnalyticsChartRangeDate(endKey, true);

  const start = parseAnalyticsDateKeyLocal(startKey);
  const end = parseAnalyticsDateKeyLocal(endKey);
  const isLongPeriod = normalizedPeriod === ANALYTICS_PERIODS.sixMonths || normalizedPeriod === ANALYTICS_PERIODS.year;
  const includeStartYear = isLongPeriod || start.getFullYear() !== end.getFullYear();
  return `${formatAnalyticsChartRangeDate(startKey, includeStartYear)} - ${formatAnalyticsChartRangeDate(endKey, true)}`;
}

export function buildAnalyticsChartPeriodTabs(period = ANALYTICS_PERIODS.month, options = ANALYTICS_CHART_PERIOD_OPTIONS) {
  const selectedPeriod = normalizeAnalyticsPeriod(period);
  return (Array.isArray(options) ? options : ANALYTICS_CHART_PERIOD_OPTIONS).map((option) => {
    const id = normalizeAnalyticsPeriod(option);
    return {
      id,
      label: ANALYTICS_CHART_PERIOD_LABELS[id] || id,
      isActive: id === selectedPeriod,
      isLongPeriod: isLongAnalyticsChartPeriod(id)
    };
  });
}

export function buildAnalyticsChartCoordinates(points = [], width = 430, height = CHART_HEIGHT) {
  const source = Array.isArray(points) ? points : [];
  const plotWidth = Math.max(1, width - CHART_PADDING.left - CHART_PADDING.right);
  const plotHeight = Math.max(1, height - CHART_PADDING.top - CHART_PADDING.bottom);
  const values = source.map((point) => Number(point.value)).filter(Number.isFinite);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const range = Math.max(1, maxValue - minValue);

  return source.map((point, index) => {
    const x = CHART_PADDING.left + (source.length <= 1 ? plotWidth / 2 : (plotWidth * index) / (source.length - 1));
    const normalizedValue = (Number(point.value || 0) - minValue) / range;
    const y = CHART_PADDING.top + plotHeight - (normalizedValue * plotHeight);
    return {
      ...point,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10
    };
  });
}

export function buildAnalyticsChartPath(coordinates = []) {
  if (!coordinates.length) return "";
  return coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function buildAnalyticsChartLabels(points = [], period = ANALYTICS_PERIODS.month) {
  if (!points.length) return [];
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  if (normalizedPeriod === ANALYTICS_PERIODS.year || normalizedPeriod === ANALYTICS_PERIODS.sixMonths) {
    const labelsByMonth = new Map();
    points.forEach((point) => {
      const date = parseAnalyticsDateKeyLocal(point.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!labelsByMonth.has(key)) {
        labelsByMonth.set(key, {
          date: point.date,
          label: formatAnalyticsChartDateLabel(point.date, normalizedPeriod)
        });
      }
    });
    return Array.from(labelsByMonth.values());
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first.date === last.date) {
    return [{ date: first.date, label: formatAnalyticsChartDateLabel(first.date, normalizedPeriod) }];
  }
  return [
    { date: first.date, label: formatAnalyticsChartDateLabel(first.date, normalizedPeriod) },
    { date: last.date, label: formatAnalyticsChartDateLabel(last.date, normalizedPeriod) }
  ];
}

export function buildAnalyticsSourceSeries(definition = {}, source = {}) {
  if (definition.source === "measurements") {
    return buildMeasurementSeries(source.measurements, definition.metricKey);
  }
  if (definition.source === "health") {
    return buildHealthSeries(source.healthLogs, definition.metricKey);
  }
  if (definition.source === "nutrition") {
    return buildNutritionSeries(source.nutritionDays, definition.metricKey);
  }
  if (definition.source === "training") {
    return buildTrainingSeries(source.workouts, definition.metricKey);
  }
  return [];
}

export function buildAnalyticsChartCard(definition = {}, source = {}, options = {}) {
  const period = normalizeAnalyticsPeriod(options.period || ANALYTICS_PERIODS.month);
  const selectedDateKey = options.selectedDateKey || "";
  const width = getAnalyticsChartSvgWidth(period);
  const height = options.height || CHART_HEIGHT;
  const rawPoints = buildAnalyticsSourceSeries(definition, source);
  const chartPoints = filterRollingAnalyticsPoints(rawPoints, period, selectedDateKey);
  const coordinates = buildAnalyticsChartCoordinates(chartPoints, width, height);
  const stats = analyticsSummary(chartPoints);

  return {
    key: definition.key,
    title: definition.title,
    metricKey: definition.metricKey,
    source: definition.source,
    tone: definition.tone,
    unit: definition.unit,
    period,
    range: getAnalyticsChartRollingRange(period, selectedDateKey),
    width,
    height,
    isLongPeriod: isLongAnalyticsChartPeriod(period),
    chartPoints,
    coordinates,
    path: buildAnalyticsChartPath(coordinates),
    labels: buildAnalyticsChartLabels(chartPoints, period),
    stats: {
      ...stats,
      avgLabel: formatAnalyticsChartValue(stats.avg, definition.unit),
      minLabel: formatAnalyticsChartValue(stats.min, definition.unit),
      maxLabel: formatAnalyticsChartValue(stats.max, definition.unit),
      changeLabel: formatAnalyticsChartValue(stats.change, definition.unit)
    },
    hasData: chartPoints.length > 0
  };
}

export function buildAnalyticsChartsViewModel(source = {}, options = {}) {
  const period = normalizeAnalyticsPeriod(options.period || ANALYTICS_PERIODS.month);
  const selectedDateKey = options.selectedDateKey || "";
  const range = getAnalyticsChartRollingRange(period, selectedDateKey);
  const charts = (options.definitions || ANALYTICS_CHART_DEFINITIONS)
    .map((definition) => buildAnalyticsChartCard(definition, source, { period, selectedDateKey }));

  return {
    period,
    selectedPeriodLabel: ANALYTICS_CHART_PERIOD_LABELS[period] || period,
    selectedDateKey,
    range,
    rangeLabel: formatAnalyticsChartRangeLabel(range, period),
    previousDateKey: shiftAnalyticsChartDivisionDate(selectedDateKey, period, -1),
    nextDateKey: shiftAnalyticsChartDivisionDate(selectedDateKey, period, 1),
    periodTabs: buildAnalyticsChartPeriodTabs(period, options.periodOptions),
    isWideLayout: isLongAnalyticsChartPeriod(period),
    layoutLabel: isLongAnalyticsChartPeriod(period) ? "wide layout" : "compact layout",
    charts,
    chartsWithData: charts.filter((chart) => chart.hasData).length,
    hasAnyData: charts.some((chart) => chart.hasData)
  };
}

export function buildAnalyticsChartsScreenViewModel(source = {}, options = {}) {
  return {
    eyebrow: "UI Extraction",
    title: options.title || "Analytics charts",
    description: "Карточки графиков получают готовые chartPoints, stats, period range и long-period layout flag из analytics domain.",
    ...buildAnalyticsChartsViewModel(source, options)
  };
}
