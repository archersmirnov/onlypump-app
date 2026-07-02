import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  STUDENT_ACTIVITY_ITEMS,
  buildStudentDashboardModeTabs,
  buildStudentActivityMarks,
  buildStudentAnalyticsSummary,
  buildStudentCardModel,
  buildStudentsDashboardSummary,
  buildStudentsTrainerDashboardViewModel,
  buildStudentsDashboardViewModel,
  buildTrainerAccessPanelSummary,
  filterAndSortStudentCards,
  formatStudentAccessUntil,
  getStudentAccessStatusLabel,
  getStudentIdentity,
  getStudentRoleLabels,
  getStudentTitle,
  getStudentTodayActivityScore,
  normalizeStudentAccessStatus,
  normalizeStudentRoles,
  normalizeStudentTodayActivity
} from "../src/features/students/domain/index.js";

const root = resolve(new URL("..", import.meta.url).pathname);

function assert(condition, message) {
  if (!condition) {
    console.error(`check-students-dashboard failed: ${message}`);
    process.exit(1);
  }
}

const students = [
  {
    id: "student-1",
    display_name: "Кира",
    telegram_username: "kira_fit",
    roles: ["student"],
    access_status: "allowed",
    today_activity: {
      opened_app: true,
      entered_data: true,
      logged_nutrition: false,
      logged_steps: true,
      logged_workout: false
    },
    analytics_30d: {
      completed_workouts_count: 4,
      total_volume: 12345.6,
      total_sets: 42,
      steps_average: 8100
    }
  },
  {
    id: "student-2",
    display_name: "Алекс",
    email: "alex@example.test",
    member_role: "student",
    access_status: "pending",
    todayActivity: {
      openedApp: false,
      enteredData: false,
      loggedNutrition: false,
      loggedSteps: false,
      loggedWorkout: false
    },
    analytics30d: {
      completedWorkoutsCount: 1,
      totalVolume: 5000,
      totalSets: 10,
      stepsAverage: 4000
    }
  },
  {
    id: "student-3",
    display_name: "Борис",
    telegram_id: "777",
    roles: "student trainer",
    access_status: "blocked",
    today_activity: {
      opened_app: true,
      entered_data: true,
      logged_nutrition: true,
      logged_steps: true,
      logged_workout: true
    },
    analytics_30d: {
      completed_workouts_count: 2,
      total_volume: 6000,
      total_sets: 20,
      steps_average: 9000
    }
  }
];

assert(STUDENT_ACTIVITY_ITEMS.length === 5, "control must have exactly five activity marks");
assert(getStudentTitle(students[0]) === "Кира", "student title should prefer display_name");
assert(getStudentIdentity(students[0]) === "@kira_fit", "student identity should prefer telegram username");
assert(getStudentIdentity(students[1]) === "alex@example.test", "student identity should fall back to email");
assert(getStudentIdentity(students[2]) === "ID 777", "student identity should fall back to telegram id");

assert(normalizeStudentRoles("student trainer").join("|") === "student|trainer", "role string should normalize");
assert(getStudentRoleLabels(students[2]) === "ученик · тренер", "role labels should be localized");
assert(normalizeStudentAccessStatus("active") === "allowed", "active access should normalize to allowed");
assert(getStudentAccessStatusLabel("blocked") === "заблокирован", "blocked access label should match legacy copy");
assert(formatStudentAccessUntil("") === "бессрочно", "empty access date should be permanent");

const activity = normalizeStudentTodayActivity(students[0].today_activity);
assert(activity.opened_app && activity.entered_data && activity.logged_steps, "snake case activity should normalize");
assert(getStudentTodayActivityScore(students[0]) === 3, "student one score should be 3/5");
assert(getStudentTodayActivityScore(students[1]) === 0, "student two score should be 0/5");
assert(getStudentTodayActivityScore(students[2]) === 5, "student three score should be 5/5");

const marks = buildStudentActivityMarks(students[0]);
assert(marks.map((mark) => mark.mark).join("") === "++-+-", "activity marks should keep legacy order");

const summary = buildStudentAnalyticsSummary(students[0]);
assert(summary.workouts === 4, "analytics workouts should normalize");
assert(summary.totalVolume === 12346, "analytics volume should round");
assert(summary.totalSets === 42, "analytics sets should normalize");
assert(summary.stepsAverage === 8100, "analytics steps average should normalize");

const card = buildStudentCardModel(students[0]);
assert(card.activityScoreLabel === "3/5", "card should expose activity score label");
assert(card.accessStatusLabel === "доступ есть", "card should expose access label");

const sortedForControl = filterAndSortStudentCards(students, { viewMode: "control" });
assert(sortedForControl.map((item) => item.title).join("|") === "Алекс|Кира|Борис", "control view should sort by low score first");

const filtered = filterAndSortStudentCards(students, { query: "kira" });
assert(filtered.length === 1 && filtered[0].title === "Кира", "student search should match identity");

const model = buildStudentsDashboardViewModel(students, { viewMode: "control", selectedDateKey: "2026-07-01" });
assert(model.cards.length === 3, "view model should include three cards");
assert(model.summary.total === 3, "summary total should count all students");
assert(model.summary.activeAccessCount === 1, "summary should count allowed access");
assert(model.summary.fullControlCount === 1, "summary should count full control students");
assert(model.summary.averageActivityScore === 2.7, "summary should average activity score");

const visibleSummary = buildStudentsDashboardSummary(model.cards);
assert(visibleSummary.analytics.workouts === 7, "summary should add workouts");
assert(visibleSummary.analytics.totalSets === 72, "summary should add sets");

const modeTabs = buildStudentDashboardModeTabs("control", {
  control: model,
  list: buildStudentsDashboardViewModel(students, { viewMode: "list" })
});
assert(modeTabs.find((tab) => tab.id === "control").isActive, "control tab should be active");
assert(modeTabs.find((tab) => tab.id === "list").label === "Мои ученики", "list tab label should be localized");

const panelSummary = buildTrainerAccessPanelSummary({
  users: [{ access_status: "pending" }, { access_status: "allowed" }],
  invites: [{ is_active: true }, { is_active: false }, {}],
  students
});
assert(panelSummary.usersCount === 2, "panel summary should count users");
assert(panelSummary.pendingUsersCount === 1, "panel summary should count pending users");
assert(panelSummary.invitesCount === 3, "panel summary should count invites");
assert(panelSummary.activeInvitesCount === 2, "panel summary should treat missing invite active as true");
assert(panelSummary.students.length === 3, "panel summary should include student cards");

const trainerDashboard = buildStudentsTrainerDashboardViewModel(students, {
  users: [{ access_status: "pending" }, { access_status: "allowed" }],
  invites: [{ is_active: true }, { is_active: false }, {}],
  students
}, {
  selectedDateKey: "2026-07-01",
  title: "Ученики"
});
assert(trainerDashboard.title === "Ученики", "trainer dashboard should expose title");
assert(trainerDashboard.studentCountLabel === "3 ученика", "trainer dashboard should expose count label");
assert(trainerDashboard.modeTabs.length === 2, "trainer dashboard should expose mode tabs");
assert(trainerDashboard.summaryCards.length === 4, "trainer dashboard should expose four summary cards");
assert(trainerDashboard.controlPanel.cards.length === 3, "trainer dashboard should expose control cards");
assert(trainerDashboard.studentsPanel.cards.length === 3, "trainer dashboard should expose student list cards");
assert(trainerDashboard.persistenceBoundary.isReadOnly, "trainer dashboard should be read-only");
assert(
  trainerDashboard.persistenceBoundary.description.includes("не меняет"),
  "trainer dashboard boundary should describe no writes"
);

const routesSource = await readFile(resolve(root, "src/app/previewRoutes.jsx"), "utf8");
assert(routesSource.includes("StudentsTrainerPreview"), "Preview routes should render StudentsTrainerPreview");
assert(routesSource.includes('id: "students"'), "Preview routes should register students route");

const previewSource = await readFile(resolve(root, "src/features/students/ui/StudentsTrainerPreview.jsx"), "utf8");
assert(
  previewSource.includes("buildStudentsTrainerDashboardViewModel"),
  "Students preview should use trainer dashboard view model"
);
assert(previewSource.includes("model.modeTabs"), "Students preview should render mode tabs from model");
assert(previewSource.includes("model.summaryCards"), "Students preview should render summary cards from model");
assert(
  previewSource.includes("model.persistenceBoundary.description"),
  "Students preview should expose read-only boundary"
);

const studentsIndexSource = await readFile(resolve(root, "src/features/students/index.js"), "utf8");
assert(studentsIndexSource.includes("./domain/index.js"), "feature index should expose domain only");

console.log("check-students-dashboard passed");
