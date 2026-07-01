import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  addWorkoutScreenDays,
  buildWorkoutCalendarDays,
  buildWorkoutCardModel,
  buildWorkoutExerciseRows,
  buildWorkoutSetRows,
  buildWorkoutWeekSummary,
  buildWorkoutsScreenViewModel,
  formatWorkoutScreenDateKey,
  getWorkoutScreenDateKey,
  getWorkoutSetVolumeForScreen
} from "../src/features/workouts/domain/index.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const workoutsIndexSource = await readFile(new URL("../src/features/workouts/index.js", import.meta.url), "utf8");
const workoutsDomainIndexSource = await readFile(new URL("../src/features/workouts/domain/index.js", import.meta.url), "utf8");
const previewSource = await readFile(new URL("../src/features/workouts/ui/WorkoutsPreview.jsx", import.meta.url), "utf8");

assert.equal(formatWorkoutScreenDateKey("2026-07-01T18:00:00+00:00"), "2026-07-01");
assert.equal(addWorkoutScreenDays("2026-07-01", 1), "2026-07-02");
assert.equal(addWorkoutScreenDays("2026-07-01", -3), "2026-06-28");
assert.equal(getWorkoutScreenDateKey({ workout_date: "2026-07-03T10:00:00+00:00" }), "2026-07-03");

const calendar = buildWorkoutCalendarDays("2026-07-01", 7);
assert.deepEqual(calendar.map((day) => day.dateKey), [
  "2026-06-28",
  "2026-06-29",
  "2026-06-30",
  "2026-07-01",
  "2026-07-02",
  "2026-07-03",
  "2026-07-04"
]);
assert.equal(calendar[3].isSelected, true);

assert.equal(getWorkoutSetVolumeForScreen({ weight: 100, reps: 8 }), 800);
assert.deepEqual(buildWorkoutSetRows([
  { id: "set-2", order: 2, weight: 90, reps: 8, status: "pending" },
  { id: "set-1", order: 1, weight: 80, reps: 10, status: "completed" }
]).map((set) => set.id), ["set-1", "set-2"]);

const workouts = [
  {
    id: "completed-1",
    supabaseId: "server-1",
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
        sets: [
          { id: "set-4", order: 1, weight: 55, reps: 12, status: "completed" },
          { id: "set-5", order: 2, weight: 60, reps: 10, status: "completed" }
        ]
      }
    ]
  },
  {
    id: "planned-1",
    supabaseId: "server-2",
    date: "2026-07-01",
    title: "Плечи Самсона",
    status: "planned",
    workoutType: "strength",
    exercises: [
      {
        id: "exercise-3",
        order: 1,
        name: "Присед",
        muscleGroup: "Ноги",
        sets: [
          { id: "set-6", order: 1, weight: 100, reps: 10, status: "pending" },
          { id: "set-7", order: 2, weight: 105, reps: 10, status: "pending" },
          { id: "set-8", order: 3, weight: 110, reps: 8, status: "pending" }
        ]
      }
    ]
  },
  {
    id: "active-1",
    supabaseId: "server-3",
    date: "2026-07-02",
    title: "Front A",
    status: "active",
    workoutType: "strength",
    exercises: [
      {
        id: "exercise-4",
        order: 1,
        name: "Жим гантелей",
        muscleGroup: "Плечи",
        sets: [
          { id: "set-9", order: 1, weight: 28, reps: 10, status: "completed" },
          { id: "set-10", order: 2, weight: 30, reps: 8, status: "pending" },
          { id: "set-11", order: 3, weight: 30, reps: 8, status: "pending" }
        ]
      }
    ]
  }
];

const card = buildWorkoutCardModel(workouts[0]);
assert.equal(card.title, "Пул ап / Пуш даун");
assert.equal(card.statusLabel, "Выполнена");
assert.equal(card.exerciseCount, 2);
assert.equal(card.completedSets, 5);
assert.equal(card.totalSets, 5);
assert.equal(card.progress, 100);
assert.equal(card.totalVolume, 3160);
assert.equal(card.exerciseRows[0].completion.done, true);

const exerciseRows = buildWorkoutExerciseRows(workouts[2]);
assert.equal(exerciseRows[0].activeSetId, "set-10");
assert.equal(exerciseRows[0].completion.partial, true);

const weekSummary = buildWorkoutWeekSummary(workouts, "2026-07-01");
assert.equal(weekSummary.workoutsCount, 3);
assert.equal(weekSummary.completedWorkoutsCount, 1);
assert.equal(weekSummary.totalSets, 11);
assert.equal(weekSummary.completedSets, 5);
assert.equal(weekSummary.totalVolume, 3160);
assert.equal(weekSummary.progress, 45);

const model = buildWorkoutsScreenViewModel(workouts, { selectedDateKey: "2026-07-01" });
assert.equal(model.selectedWorkoutCards.length, 2);
assert.equal(model.activeWorkout, null);
assert.equal(model.calendarDays[3].workoutsCount, 2);
assert.equal(model.calendarDays[4].workoutsCount, 1);

const activeModel = buildWorkoutsScreenViewModel(workouts, { selectedDateKey: "2026-07-02" });
assert.equal(activeModel.activeWorkout.title, "Front A");
assert.equal(activeModel.activeWorkout.progress, 33);

assert.match(workoutsDomainIndexSource, /workoutScreenModel\.js/);
assert.doesNotMatch(workoutsIndexSource, /ui\/index\.js/);
assert.match(workoutsIndexSource, /api\/index\.js/);
assert.match(workoutsIndexSource, /sync\/index\.js/);
assert.match(previewSource, /buildWorkoutsScreenViewModel/);
assert.match(appSource, /import \{ WorkoutsPreview \} from "\.\/features\/workouts\/ui\/index\.js"/);
assert.match(appSource, /<WorkoutsPreview/);

console.log("workouts ui checks passed");
