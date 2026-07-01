import { buildWorkoutsScreenViewModel } from "../domain/index.js";

const previewWorkouts = [
  {
    id: "workout-1",
    supabaseId: "workout-server-1",
    date: "2026-07-01",
    title: "Пул ап / Пуш даун",
    status: "completed",
    workoutType: "strength",
    durationMinutes: 54,
    exercises: [
      {
        id: "exercise-1",
        order: 1,
        name: "Вертикальная тяга",
        muscleGroup: "Спина",
        restSeconds: 120,
        sets: [
          { id: "set-1", order: 1, weight: 70, reps: 10, status: "completed" },
          { id: "set-2", order: 2, weight: 75, reps: 8, status: "completed" },
          { id: "set-3", order: 3, weight: 75, reps: 8, status: "completed" }
        ]
      },
      {
        id: "exercise-2",
        order: 2,
        name: "Жим в блоке",
        muscleGroup: "Грудь",
        restSeconds: 120,
        sets: [
          { id: "set-4", order: 1, weight: 55, reps: 12, status: "completed" },
          { id: "set-5", order: 2, weight: 60, reps: 10, status: "completed" }
        ]
      }
    ]
  },
  {
    id: "workout-2",
    supabaseId: "workout-server-2",
    date: "2026-07-01",
    title: "Плечи Самсона B — ноги база",
    status: "planned",
    workoutType: "strength",
    exercises: [
      {
        id: "exercise-3",
        order: 1,
        name: "Присед в гакке",
        muscleGroup: "Ноги",
        restSeconds: 150,
        sets: [
          { id: "set-6", order: 1, weight: 100, reps: 10, status: "pending" },
          { id: "set-7", order: 2, weight: 105, reps: 10, status: "pending" },
          { id: "set-8", order: 3, weight: 110, reps: 8, status: "pending" }
        ]
      }
    ]
  },
  {
    id: "workout-3",
    supabaseId: "workout-server-3",
    date: "2026-07-02",
    title: "Front A",
    status: "active",
    workoutType: "strength",
    exercises: [
      {
        id: "exercise-4",
        order: 1,
        name: "Жим гантелей сидя",
        muscleGroup: "Плечи",
        restSeconds: 120,
        sets: [
          { id: "set-9", order: 1, weight: 28, reps: 10, status: "completed" },
          { id: "set-10", order: 2, weight: 30, reps: 8, status: "pending" },
          { id: "set-11", order: 3, weight: 30, reps: 8, status: "pending" }
        ]
      }
    ]
  }
];

function WorkoutsProgress({ value }) {
  return (
    <span className="workouts-progress" aria-hidden="true">
      <span className="workouts-progress__fill" style={{ width: `${value}%` }} />
    </span>
  );
}

export function WorkoutsPreview({
  workouts = previewWorkouts,
  selectedDateKey = "2026-07-01",
  title = "Workouts UI"
}) {
  const model = buildWorkoutsScreenViewModel(workouts, { selectedDateKey });
  const primaryWorkout = model.selectedWorkoutCards[0] || null;

  return (
    <section className="workouts-preview" aria-labelledby="workouts-preview-title">
      <div className="workouts-preview__header">
        <div>
          <p className="workouts-preview__eyebrow">UI Extraction</p>
          <h2 id="workouts-preview-title">{title}</h2>
          <p>
            Экран тренировок получает готовые calendar days, week summary,
            workout cards и exercise rows без прямого доступа к persistence.
          </p>
        </div>
        <span className="workouts-preview__mode">{model.selectedWorkoutCards.length} в выбранный день</span>
      </div>

      <div className="workouts-preview__calendar">
        {model.calendarDays.map((day) => (
          <div key={day.dateKey} className={`workouts-preview-day${day.isSelected ? " workouts-preview-day--active" : ""}`}>
            <span>{day.dayLabel}</span>
            <strong>{day.dayNumber}</strong>
            <i>{day.hasWorkouts ? day.workoutsCount : ""}</i>
          </div>
        ))}
      </div>

      <div className="workouts-preview__grid">
        <article className="workouts-preview-card workouts-preview-card--summary">
          <div className="workouts-preview-card__topline">
            <span>Объем недели</span>
            <strong>{model.weekSummary.workoutsCount} тренировок</strong>
          </div>
          <div className="workouts-preview__sets">
            <strong>{model.weekSummary.totalSets}</strong>
            <span>подходов запланировано и выполнено</span>
          </div>
          <WorkoutsProgress value={model.weekSummary.progress} />
          <p>{model.weekSummary.completedSets} подходов уже выполнено</p>
        </article>

        <article className="workouts-preview-card">
          <div className="workouts-preview-card__topline">
            <span>Тренировки дня</span>
            <strong>{model.selectedDateKey}</strong>
          </div>
          <div className="workouts-preview__cards">
            {model.selectedWorkoutCards.map((workout) => (
              <div key={workout.id} className="workouts-preview-workout">
                <span style={{ background: workout.typeColor }} />
                <div>
                  <strong>{workout.title}</strong>
                  <em>{workout.statusLabel} · {workout.completedSets}/{workout.totalSets}</em>
                </div>
                <b>{workout.typeLabel}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="workouts-preview-card workouts-preview-card--wide">
          <div className="workouts-preview-card__topline">
            <span>Упражнения</span>
            <strong>{primaryWorkout ? primaryWorkout.title : "нет тренировки"}</strong>
          </div>
          <div className="workouts-preview__exercises">
            {(primaryWorkout?.exerciseRows || []).map((exercise) => (
              <div key={exercise.id} className="workouts-preview-exercise">
                <div>
                  <strong>{exercise.name}</strong>
                  <span>{exercise.muscleGroup} · {exercise.completion.completed}/{exercise.completion.total} подходов</span>
                </div>
                <div className="workouts-preview-exercise__sets">
                  {exercise.setRows.map((set) => (
                    <b key={set.id} className={set.isCompleted ? "is-done" : ""}>{set.label}</b>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
