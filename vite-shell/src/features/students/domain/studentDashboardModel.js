export const STUDENT_DASHBOARD_VIEW_MODES = Object.freeze({
  list: "list",
  control: "control"
});

export const STUDENT_ACTIVITY_ITEMS = Object.freeze([
  { key: "opened_app", label: "Заходил" },
  { key: "entered_data", label: "Данные" },
  { key: "logged_nutrition", label: "Питание" },
  { key: "logged_steps", label: "Шаги" },
  { key: "logged_workout", label: "Тренировки" }
]);

export const STUDENT_ROLE_LABELS = Object.freeze({
  owner: "владелец",
  admin: "админ",
  trainer: "тренер",
  student: "ученик",
  user: "пользователь"
});

const ASSIGNABLE_ROLES = Object.freeze(["admin", "trainer", "student", "user"]);

function parseBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "да", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "нет", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeRoleToken(value = "") {
  const role = String(value || "").trim().toLowerCase();
  return [...ASSIGNABLE_ROLES, "owner"].includes(role) ? role : "";
}

export function normalizeStudentRoles(value = [], profile = {}) {
  const roles = new Set();
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  source.forEach((item) => {
    const role = normalizeRoleToken(item);
    if (role) roles.add(role);
  });

  if (parseBoolean(profile.is_owner)) roles.add("owner");
  if (parseBoolean(profile.is_admin)) roles.add("admin");
  if (parseBoolean(profile.is_trainer)) roles.add("trainer");

  const memberRole = normalizeRoleToken(profile.member_role || profile.role);
  if (memberRole) roles.add(memberRole);

  if (!roles.size) roles.add("user");
  if (roles.size > 1 && roles.has("user")) roles.delete("user");

  return Array.from(roles);
}

export function getStudentRoleLabels(profile = {}) {
  const roles = normalizeStudentRoles(profile.roles, profile).filter((role) => STUDENT_ROLE_LABELS[role]);
  if (!roles.length) return STUDENT_ROLE_LABELS.user;
  return roles.map((role) => STUDENT_ROLE_LABELS[role]).join(" · ");
}

export function getStudentTitle(student = {}) {
  return student.display_name
    || student.displayName
    || student.full_name
    || student.fullName
    || student.telegram_username
    || student.telegramUsername
    || student.email
    || student.telegram_id
    || student.telegramId
    || "Пользователь";
}

export function getStudentIdentity(student = {}) {
  const username = student.telegram_username || student.telegramUsername;
  const email = student.email;
  const telegramId = student.telegram_id || student.telegramId;
  if (username) return `@${String(username).replace(/^@/, "")}`;
  if (email) return email;
  if (telegramId) return `ID ${telegramId}`;
  return "Web аккаунт";
}

export function normalizeStudentAccessStatus(status = "pending") {
  const normalized = String(status || "pending").trim().toLowerCase();
  if (["allowed", "active", "approved", "enabled"].includes(normalized)) return "allowed";
  if (["blocked", "disabled", "banned", "rejected"].includes(normalized)) return "blocked";
  return "pending";
}

export function getStudentAccessStatusLabel(status = "pending") {
  const normalized = normalizeStudentAccessStatus(status);
  if (normalized === "allowed") return "доступ есть";
  if (normalized === "blocked") return "заблокирован";
  return "ожидает доступа";
}

export function formatStudentAccessUntil(value = "") {
  if (!value) return "бессрочно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "бессрочно";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function normalizeStudentTodayActivity(activity = {}) {
  return {
    opened_app: Boolean(activity.opened_app || activity.openedApp),
    entered_data: Boolean(activity.entered_data || activity.enteredData),
    logged_nutrition: Boolean(activity.logged_nutrition || activity.loggedNutrition),
    logged_steps: Boolean(activity.logged_steps || activity.loggedSteps),
    logged_workout: Boolean(activity.logged_workout || activity.loggedWorkout)
  };
}

export function getStudentTodayActivityScore(student = {}) {
  const activity = normalizeStudentTodayActivity(student.today_activity || student.todayActivity);
  return STUDENT_ACTIVITY_ITEMS.reduce((sum, item) => sum + (activity[item.key] ? 1 : 0), 0);
}

export function buildStudentActivityMarks(student = {}) {
  const activity = normalizeStudentTodayActivity(student.today_activity || student.todayActivity);
  return STUDENT_ACTIVITY_ITEMS.map((item) => ({
    ...item,
    active: Boolean(activity[item.key]),
    mark: activity[item.key] ? "+" : "-"
  }));
}

export function buildStudentAnalyticsSummary(student = {}) {
  const analytics = student.analytics_30d || student.analytics30d || {};
  const workouts = Number(analytics.completed_workouts_count || analytics.completedWorkoutsCount || 0);
  const totalVolume = Number(analytics.total_volume || analytics.totalVolume || 0);
  const totalSets = Number(analytics.total_sets || analytics.totalSets || 0);
  const stepsAverage = Number(analytics.steps_average || analytics.stepsAverage || 0);

  return {
    workouts: Number.isFinite(workouts) ? Math.max(0, Math.round(workouts)) : 0,
    totalVolume: Number.isFinite(totalVolume) ? Math.max(0, Math.round(totalVolume)) : 0,
    totalSets: Number.isFinite(totalSets) ? Math.max(0, Math.round(totalSets)) : 0,
    stepsAverage: Number.isFinite(stepsAverage) ? Math.max(0, Math.round(stepsAverage)) : 0
  };
}

export function buildStudentCardModel(student = {}) {
  const title = getStudentTitle(student);
  const identity = getStudentIdentity(student);
  const activityScore = getStudentTodayActivityScore(student);
  const accessStatus = normalizeStudentAccessStatus(student.access_status || student.accessStatus);

  return {
    id: String(student.id || student.profile_id || student.telegram_id || title),
    title,
    identity,
    initials: String(title || "?").trim().slice(0, 1).toUpperCase() || "?",
    roleLabel: getStudentRoleLabels(student),
    accessStatus,
    accessStatusLabel: getStudentAccessStatusLabel(accessStatus),
    accessUntilLabel: formatStudentAccessUntil(student.access_expires_at || student.accessExpiresAt),
    activityScore,
    activityScoreLabel: `${activityScore}/${STUDENT_ACTIVITY_ITEMS.length}`,
    activityMarks: buildStudentActivityMarks(student),
    analytics: buildStudentAnalyticsSummary(student)
  };
}

export function filterAndSortStudentCards(students = [], options = {}) {
  const query = String(options.query || "").trim().toLowerCase();
  const viewMode = options.viewMode || STUDENT_DASHBOARD_VIEW_MODES.list;
  const cards = (Array.isArray(students) ? students : []).map(buildStudentCardModel);

  return cards
    .filter((card) => {
      if (!query) return true;
      return [card.title, card.identity, card.roleLabel, card.accessStatusLabel]
        .some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (viewMode === STUDENT_DASHBOARD_VIEW_MODES.control) {
        const scoreDelta = a.activityScore - b.activityScore;
        if (scoreDelta) return scoreDelta;
      }
      return a.title.localeCompare(b.title, "ru");
    });
}

export function buildStudentsDashboardSummary(cards = []) {
  const source = Array.isArray(cards) ? cards : [];
  const total = source.length;
  const scoreTotal = source.reduce((sum, card) => sum + card.activityScore, 0);
  const analytics = source.reduce((acc, card) => {
    acc.workouts += card.analytics.workouts;
    acc.totalVolume += card.analytics.totalVolume;
    acc.totalSets += card.analytics.totalSets;
    acc.stepsAverage += card.analytics.stepsAverage;
    return acc;
  }, { workouts: 0, totalVolume: 0, totalSets: 0, stepsAverage: 0 });

  return {
    total,
    activeAccessCount: source.filter((card) => card.accessStatus === "allowed").length,
    fullControlCount: source.filter((card) => card.activityScore === STUDENT_ACTIVITY_ITEMS.length).length,
    averageActivityScore: total ? Math.round((scoreTotal / total) * 10) / 10 : 0,
    analytics: {
      workouts: analytics.workouts,
      totalVolume: analytics.totalVolume,
      totalSets: analytics.totalSets,
      stepsAverage: total ? Math.round(analytics.stepsAverage / total) : 0
    }
  };
}

export function buildStudentsDashboardViewModel(students = [], options = {}) {
  const viewMode = Object.values(STUDENT_DASHBOARD_VIEW_MODES).includes(options.viewMode)
    ? options.viewMode
    : STUDENT_DASHBOARD_VIEW_MODES.list;
  const allCards = (Array.isArray(students) ? students : []).map(buildStudentCardModel);
  const visibleCards = filterAndSortStudentCards(students, { query: options.query, viewMode });

  return {
    viewMode,
    query: String(options.query || ""),
    selectedDateKey: options.selectedDateKey || "",
    cards: visibleCards,
    allCards,
    summary: buildStudentsDashboardSummary(allCards),
    visibleSummary: buildStudentsDashboardSummary(visibleCards),
    isEmpty: allCards.length === 0,
    isFilteredEmpty: allCards.length > 0 && visibleCards.length === 0
  };
}

export function buildTrainerAccessPanelSummary(panel = {}) {
  const students = Array.isArray(panel.students) ? panel.students.map(buildStudentCardModel) : [];
  const users = Array.isArray(panel.users) ? panel.users : [];
  const invites = Array.isArray(panel.invites) ? panel.invites : [];
  const pendingUsers = users.filter((user) => normalizeStudentAccessStatus(user.access_status || user.accessStatus) === "pending").length;
  const activeInvites = invites.filter((invite) => parseBoolean(invite.is_active ?? invite.isActive, true)).length;

  return {
    usersCount: users.length,
    pendingUsersCount: pendingUsers,
    invitesCount: invites.length,
    activeInvitesCount: activeInvites,
    students,
    studentSummary: buildStudentsDashboardSummary(students)
  };
}
