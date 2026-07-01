import {
  ANALYTICS_PERIODS,
  buildAnalyticsChartsViewModel
} from "../domain/index.js";

const previewSource = {
  measurements: [
    { measurement_date: "2026-01-01", weight_kg: 84.2 },
    { measurement_date: "2026-02-01", weight_kg: 83.4 },
    { measurement_date: "2026-03-01", weight_kg: 82.6 },
    { measurement_date: "2026-04-01", weight_kg: 81.9 },
    { measurement_date: "2026-05-01", weight_kg: 81.1 },
    { measurement_date: "2026-06-01", weight_kg: 80.6 },
    { measurement_date: "2026-07-01", weight_kg: 80.2 }
  ],
  healthLogs: [
    { log_date: "2026-01-08", steps_count: 7200 },
    { log_date: "2026-02-08", steps_count: 8400 },
    { log_date: "2026-03-08", steps_count: 7600 },
    { log_date: "2026-04-08", steps_count: 9100 },
    { log_date: "2026-05-08", steps_count: 9900 },
    { log_date: "2026-06-08", steps_count: 8700 },
    { log_date: "2026-07-01", steps_count: 10400 }
  ],
  nutritionDays: [
    { date: "2026-01-12", totals: { calories: 2360 } },
    { date: "2026-02-12", totals: { calories: 2420 } },
    { date: "2026-03-12", totals: { calories: 2290 } },
    { date: "2026-04-12", totals: { calories: 2520 } },
    { date: "2026-05-12", totals: { calories: 2460 } },
    { date: "2026-06-12", totals: { calories: 2380 } },
    { date: "2026-07-01", totals: { calories: 2440 } }
  ],
  workouts: [
    {
      date: "2026-01-16",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 80, reps: 8, status: "completed" }] }]
    },
    {
      date: "2026-02-16",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 90, reps: 8, status: "completed" }] }]
    },
    {
      date: "2026-03-16",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 95, reps: 8, status: "completed" }] }]
    },
    {
      date: "2026-04-16",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 100, reps: 8, status: "completed" }] }]
    },
    {
      date: "2026-05-16",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 105, reps: 8, status: "completed" }] }]
    },
    {
      date: "2026-06-16",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 110, reps: 8, status: "completed" }] }]
    },
    {
      date: "2026-07-01",
      status: "completed",
      workoutType: "strength",
      exercises: [{ exerciseCategory: "strength", measurementMode: "weight_reps", sets: [{ weight: 115, reps: 8, status: "completed" }] }]
    }
  ]
};

function AnalyticsChartSvg({ chart }) {
  const pointRadius = chart.isLongPeriod ? 3 : 4;

  return (
    <svg
      className="analytics-chart-preview__svg"
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      role="img"
      aria-label={chart.title}
    >
      <line x1="34" y1="136" x2={chart.width - 16} y2="136" />
      {chart.path ? <path d={chart.path} /> : null}
      {chart.coordinates.map((point) => (
        <circle key={`${point.date}-${point.value}`} cx={point.x} cy={point.y} r={pointRadius} />
      ))}
      {chart.labels.map((label, index) => {
        const point = chart.coordinates.find((item) => item.date === label.date);
        const x = point?.x || (index === 0 ? 34 : chart.width - 16);
        return (
          <text key={`${label.date}-${label.label}`} x={x} y="154">
            {label.label}
          </text>
        );
      })}
    </svg>
  );
}

export function AnalyticsChartsPreview({
  source = previewSource,
  period = ANALYTICS_PERIODS.year,
  selectedDateKey = "2026-07-01",
  title = "Analytics charts"
}) {
  const model = buildAnalyticsChartsViewModel(source, { period, selectedDateKey });

  return (
    <section className="analytics-preview" aria-labelledby="analytics-preview-title">
      <div className="analytics-preview__header">
        <div>
          <p className="analytics-preview__eyebrow">UI Extraction</p>
          <h2 id="analytics-preview-title">{title}</h2>
          <p>
            Карточки графиков получают готовые chartPoints, stats, period range
            и long-period layout flag из analytics domain.
          </p>
        </div>
        <span className="analytics-preview__mode">{model.isWideLayout ? "wide layout" : "compact layout"}</span>
      </div>

      <div className={`analytics-preview__grid${model.isWideLayout ? " analytics-preview__grid--wide" : ""}`}>
        {model.charts.map((chart) => (
          <article key={chart.key} className={`analytics-preview-card analytics-preview-card--${chart.tone}`}>
            <div className="analytics-preview-card__topline">
              <span>{chart.title}</span>
              <strong>{chart.stats.trend}</strong>
            </div>
            <div className="analytics-preview-card__chart">
              <AnalyticsChartSvg chart={chart} />
            </div>
            <div className="analytics-preview-card__stats">
              <span>среднее: {chart.stats.avgLabel}</span>
              <span>изменение: {chart.stats.changeLabel}</span>
              <span>{chart.chartPoints.length} точек</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
