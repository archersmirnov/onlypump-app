import {
  buildStudentsDashboardViewModel,
  buildTrainerAccessPanelSummary
} from "../domain/index.js";

const previewStudents = [
  {
    id: "student-1",
    display_name: "Артур",
    telegram_username: "Archer_ss",
    roles: ["student"],
    access_status: "allowed",
    access_expires_at: null,
    today_activity: {
      opened_app: true,
      entered_data: true,
      logged_nutrition: true,
      logged_steps: true,
      logged_workout: true
    },
    analytics_30d: {
      completed_workouts_count: 15,
      total_volume: 128400,
      total_sets: 190,
      steps_average: 9200
    }
  },
  {
    id: "student-2",
    display_name: "Nadia Chigantseva",
    telegram_username: "Nadia_nice2cake",
    roles: ["student"],
    access_status: "allowed",
    access_expires_at: "2026-09-01T00:00:00.000Z",
    today_activity: {
      opened_app: true,
      entered_data: true,
      logged_nutrition: false,
      logged_steps: true,
      logged_workout: false
    },
    analytics_30d: {
      completed_workouts_count: 3,
      total_volume: 18420,
      total_sets: 48,
      steps_average: 7800
    }
  },
  {
    id: "student-3",
    display_name: "Alexander Yurin",
    telegram_username: "alxndryou",
    roles: ["student"],
    access_status: "pending",
    today_activity: {
      opened_app: false,
      entered_data: false,
      logged_nutrition: false,
      logged_steps: false,
      logged_workout: false
    },
    analytics_30d: {
      completed_workouts_count: 0,
      total_volume: 0,
      total_sets: 0,
      steps_average: 0
    }
  }
];

const previewPanel = {
  permissions: {
    can_view_students: true,
    can_create_invites: true,
    can_manage_users: true
  },
  users: [
    { id: "user-1", access_status: "allowed" },
    { id: "user-2", access_status: "pending" },
    { id: "user-3", access_status: "allowed" }
  ],
  invites: [
    { id: "invite-1", is_active: true },
    { id: "invite-2", is_active: false },
    { id: "invite-3", is_active: true }
  ],
  students: previewStudents
};

function formatPreviewNumber(value = 0) {
  return Math.round(Number(value || 0)).toLocaleString("ru-RU");
}

function StudentsControlCard({ card }) {
  return (
    <article className="students-preview-card">
      <div className="students-preview-card__head">
        <span className="students-preview-avatar">{card.initials}</span>
        <div>
          <strong>{card.title}</strong>
          <em>{card.identity}</em>
        </div>
        <b>{card.activityScoreLabel}</b>
      </div>
      <div className="students-preview-marks">
        {card.activityMarks.map((mark) => (
          <span key={mark.key} className={mark.active ? "is-active" : ""}>
            <small>{mark.label}</small>
            <i>{mark.mark}</i>
          </span>
        ))}
      </div>
    </article>
  );
}

function StudentAnalyticsCard({ card }) {
  return (
    <article className="students-preview-student">
      <div>
        <strong>{card.title}</strong>
        <em>{card.identity} · {card.roleLabel}</em>
      </div>
      <div className="students-preview-stats">
        <span><b>{card.analytics.workouts}</b><small>тренировок</small></span>
        <span><b>{formatPreviewNumber(card.analytics.totalVolume)}</b><small>тоннаж</small></span>
        <span><b>{formatPreviewNumber(card.analytics.totalSets)}</b><small>подходов</small></span>
        <span><b>{formatPreviewNumber(card.analytics.stepsAverage)}</b><small>шаги ср.</small></span>
      </div>
    </article>
  );
}

export function StudentsTrainerPreview({
  students = previewStudents,
  panel = previewPanel,
  selectedDateKey = "2026-07-01",
  title = "Students / Trainer dashboards"
}) {
  const controlModel = buildStudentsDashboardViewModel(students, {
    viewMode: "control",
    selectedDateKey
  });
  const listModel = buildStudentsDashboardViewModel(students, {
    viewMode: "list",
    selectedDateKey
  });
  const trainerSummary = buildTrainerAccessPanelSummary(panel);

  return (
    <section className="students-preview" aria-labelledby="students-preview-title">
      <div className="students-preview__header">
        <div>
          <p className="students-preview__eyebrow">UI Extraction</p>
          <h2 id="students-preview-title">{title}</h2>
          <p>
            Ученики, контроль и тренерская сводка получают готовые card models
            без прямого доступа к profile API и таблицам.
          </p>
        </div>
        <span className="students-preview__mode">{controlModel.summary.total} ученика</span>
      </div>

      <div className="students-preview__summary">
        <span><b>{controlModel.summary.averageActivityScore}/5</b><small>средний контроль</small></span>
        <span><b>{controlModel.summary.fullControlCount}</b><small>закрыли день</small></span>
        <span><b>{trainerSummary.activeInvitesCount}/{trainerSummary.invitesCount}</b><small>активные ссылки</small></span>
        <span><b>{trainerSummary.pendingUsersCount}</b><small>ожидают доступ</small></span>
      </div>

      <div className="students-preview__grid">
        <article className="students-preview-panel students-preview-panel--control">
          <div className="students-preview-panel__topline">
            <span>Контроль</span>
            <strong>{selectedDateKey}</strong>
          </div>
          <div className="students-preview-list">
            {controlModel.cards.map((card) => (
              <StudentsControlCard key={card.id} card={card} />
            ))}
          </div>
        </article>

        <article className="students-preview-panel">
          <div className="students-preview-panel__topline">
            <span>Мои ученики</span>
            <strong>{trainerSummary.students.length}</strong>
          </div>
          <div className="students-preview-list">
            {listModel.cards.map((card) => (
              <StudentAnalyticsCard key={card.id} card={card} />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
