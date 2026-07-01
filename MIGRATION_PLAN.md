# ONLYPUMP Migration Plan

Дата: 2026-07-01

Цель: перевести приложение из большого `index.html` в более безопасную архитектуру без большой переписи и без повторного повреждения сохранения тренировок.

Этот файл не меняет поведение приложения.

## Текущее безопасное состояние

Ветка:

- `migrate-architecture`

Точки восстановления:

- `16285a8 Stable backup before architecture migration` - полный рабочий снимок;
- `87b29e6 Ignore local system files` - Git-гигиена;
- `bb1b051 Document current architecture map` - карта текущей архитектуры.
- `265a0d9 Document migration plan` - план миграции;
- `708d6c4 Add Vite shell` - отдельная Vite/React-оболочка.

Ключевые защитные документы:

- `ARCHITECTURE_MAP.md`;
- `SAFETY_DATA_BOUNDARIES.md`;
- `SAFETY_DIRECT_WRITES_AUDIT.md`;
- `SAFETY_CRITICAL_SCENARIOS.md`;
- `SAFETY_WORKOUT_PERSISTENCE_CHECKLIST.md`.

## Главный принцип

Миграция не должна быть переписыванием приложения.

Один шаг должен менять только один слой:

1. Документация/карта.
2. Shell/build.
3. API client.
4. Repository.
5. Mapper.
6. Sync.
7. UI.

Если шаг одновременно меняет UI, API, mapper и sync - шаг слишком большой.

## Hard Stop Rules

Остановиться и не продолжать миграцию, если:

- тренировка создается, но не остается после reload;
- повтор тренировки создает запись, но дальнейшее редактирование не сохраняется;
- удаленный set/exercise/workout возвращается;
- completed-тренировка откатывает изменения после reload;
- `onlypump-workouts-api` показывает красные ошибки в logs;
- недельный объем/аналитика начинают считать явно лишние тренировки;
- Vite shell ломает текущий статический `index.html`;
- Supabase Functions были случайно перемещены или изменены без отдельной задачи.

При stop signal:

1. Не продолжать перенос файлов.
2. Зафиксировать конкретный сценарий.
3. Смотреть Supabase logs и affected id.
4. Чинить только этот сценарий.

## Проверка после каждого шага

Минимальный smoke test:

1. Открыть приложение.
2. Проверить, что главный экран загружается.
3. Открыть тренировки.
4. Проверить, что список тренировок не пустой и не мигает старыми лишними данными.
5. Создать тестовую тренировку.
6. Добавить упражнение и 2 подхода.
7. Обновить страницу.
8. Проверить, что данные остались.
9. Удалить тестовую тренировку.
10. Обновить страницу.
11. Проверить, что она не вернулась.

Расширенный test:

- пройти `SAFETY_WORKOUT_PERSISTENCE_CHECKLIST.md`.

## Этап 0. Backup and Git

Статус: done.

Сделано:

- Git initialized;
- рабочее состояние закоммичено;
- `.gitignore` добавлен;
- ветка `migrate-architecture` создана.

Нельзя:

- делать миграцию в грязном рабочем дереве;
- начинать Vite без commit перед шагом.

## Этап 1. Architecture Map

Статус: done.

Файл:

- `ARCHITECTURE_MAP.md`

Цель:

- знать, где сейчас находятся экраны, API, кэш, mappers, sync и Supabase Functions;
- не мигрировать вслепую.

## Этап 2. Migration Plan

Статус: done.

Файл:

- `MIGRATION_PLAN.md`

Цель:

- зафиксировать порядок работ;
- определить stop rules;
- определить проверки;
- не допустить большой переписи.

Acceptance criteria:

- план существует;
- этапы конечны;
- есть правила отката;
- есть smoke test;
- есть запреты на смешивание слоев.

## Этап 3. Vite Shell Without App Rewrite

Статус: done.

Цель: завести современную сборочную оболочку, не переписывая приложение.

Разрешено:

- добавить Vite/React dependencies;
- создать `src/`;
- создать минимальные `src/main.jsx`, `src/App.jsx`;
- сохранить текущий `index.html` как legacy fallback;
- настроить scripts `dev`, `build`, `preview`;
- оставить `assets/` и `supabase/` на месте.

Запрещено:

- переписывать `WorkoutsPage`;
- переносить workout persistence;
- менять Supabase Functions;
- менять таблицы/миграции;
- менять UI-дизайн.

Промежуточный безопасный вариант:

- `index.legacy.html` остается рабочей копией старого приложения;
- новый Vite shell может сначала рендерить простую оболочку или подключать legacy app отдельным шагом;
- если Vite shell не готов, legacy приложение должно оставаться открываемым.

Acceptance criteria:

- `npm run dev` запускается;
- `npm run build` проходит;
- `assets/` доступны;
- `supabase/functions` не изменены;
- legacy backup существует;
- рабочее состояние закоммичено.

## Этап 4. Shared API Client

Статус: profile and nutrition wiring.

Цель: отделить общий вызов Edge Functions от UI и feature logic.

Предполагаемые файлы:

- `src/shared/api/edgeFunctionClient.js`;
- `src/shared/api/apiErrors.js`;
- `src/shared/api/endpoints.js`.

Начато:

- файлы созданы внутри `vite-shell/src/shared/api/`;
- сохранена текущая форма запроса `initData/action/payload`;
- добавлены compatibility wrappers со старыми именами API-вызовов;
- добавлен `pnpm run check:api` для проверки API-слоя без сети;
- добавлен browser bridge `onlypump-legacy-api-client.js`;
- legacy `index.html` подключён к `callOnlyPumpNutritionApi`;
- legacy `index.html` подключён к `callOnlyPumpProfileApi`;
- статус и wiring gate описаны в `API_CLIENT_MIGRATION_STATUS.md`;
- workouts пока не подключены к новому API-слою.

Кандидаты на перенос:

- `callOnlyPumpProfileApi`;
- `callOnlyPumpWorkoutsApi`;
- `callOnlyPumpNutritionApi`;
- error serialization;
- endpoint constants.

Запрещено:

- менять payload shape;
- менять actions;
- менять Supabase URLs без отдельного решения;
- менять UI.

Acceptance criteria:

- все старые API actions вызываются тем же способом;
- ошибки не превращаются в `[object Object]`;
- smoke test проходит.

## Этап 5. Workouts Mapper

Статус: started, not wired.

Цель: отделить преобразования данных тренировок от UI.

Предполагаемые файлы:

- `src/features/workouts/api/workoutMapper.js`;
- `src/features/workouts/domain/workoutNormalize.js`;

Кандидаты на перенос:

- `mapSupabaseWorkout`;
- `buildWorkoutTreeFromApi`;
- `buildWorkoutSupabasePayload`;
- `buildWorkoutPatchPayload`;
- `buildWorkoutTotalsPatchPayload`;
- exercise/set mapping;
- `normalizeWorkoutStatus`;
- `normalizeWorkoutType`;
- `normalizeWorkoutSupersetMetadata`.

Начато:

- создан `vite-shell/src/features/workouts/domain/workoutNormalize.js`;
- вынесены чистые helpers для workout status/type/set completion;
- добавлен `normalizeWorkoutSupersetMetadata`;
- создан `vite-shell/src/features/workouts/api/workoutMapper.js`;
- вынесен первый чистый mapper для totals patch payload;
- вынесены чистые mapper/payload helpers для workout sets;
- вынесены чистые mapper/payload helpers для workout exercises;
- собраны tree-level mapper helpers для workout create/patch/update payloads;
- вынесены read-mapper helpers для Supabase workout/exercise/set API response;
- добавлен `pnpm run check:workouts`;
- добавлен `pnpm run check:workout-mapper`;
- legacy `index.html` пока не подключен к этим helpers.

Запрещено:

- менять смысл статусов;
- менять `supabaseId` / local id поведение;
- менять расчеты подходов/тоннажа.

Acceptance criteria:

- create/repeat/edit/delete сохраняются;
- после create/repeat у workout/exercises/sets есть корректные Supabase ids;
- completed workout редактируется после reload.

## Этап 6. Workouts Repository

Статус: done, not wired.

Цель: собрать операции backend persistence в одном слое.

Предполагаемые файлы:

- `src/features/workouts/api/workoutRepository.js`;

Методы:

- `loadWorkouts`;
- `createWorkoutTree`;
- `saveWorkoutPatch`;
- `createWorkout`;
- `updateWorkout`;
- `deleteWorkout`;
- `createExercise`;
- `updateExercise`;
- `deleteExercise`;
- `createSet`;
- `updateSet`;
- `deleteSet`;
- `loadExerciseLibrary`;
- `loadProgramTemplates`;
- `saveProgramTemplate`;
- `createUserProgram`.

Начато:

- создан `vite-shell/src/features/workouts/api/workoutRepository.js`;
- добавлен repository factory поверх текущих workout API actions;
- добавлены методы `loadWorkouts`, `createWorkoutTree`, `updateWorkoutTree`, `saveWorkoutPatch`, `deleteWorkout`;
- добавлены методы `createExercise`, `updateExercise`, `deleteExercise`, `createSet`, `updateSet`, `deleteSet`;
- добавлены методы `loadExerciseLibrary`, `loadProgramTemplates`;
- добавлены методы `loadUserPrograms`, `saveProgramTemplate`, `updateProgramTemplate`, `shareProgramTemplate`, `createUserProgram`, `renameWorkoutScope`, `deleteWorkoutScope`, `deleteProgramScope`;
- добавлены методы `createWorkout`, `updateWorkout`, `loadExerciseHistory`;
- финальная сверка покрыла прямые workout API actions из legacy `index.html`;
- добавлен `pnpm run check:workout-repository`;
- legacy `index.html` пока не подключен к repository.

Запрещено:

- вызывать Edge Function напрямую из UI после переноса;
- менять backend actions;
- менять optimistic UI без отдельного шага.

Acceptance criteria:

- все workout API calls идут через repository;
- UI все еще работает;
- persistence checklist проходит.

## Этап 7. Workouts Sync

Статус: done, not wired.

Цель: отделить autosave/pending/retry/cache policy от экрана.

Предполагаемые файлы:

- `src/features/workouts/sync/workoutSync.js`;
- `src/features/workouts/sync/workoutCache.js`;
- `src/features/workouts/sync/workoutPendingQueue.js`.

Кандидаты на перенос:

- `sendWorkoutPatch`;
- `queueWorkoutPatch`;
- pending patch refs;
- dirty state merge;
- cache fallback policy;
- flush/retry.

Сделано:

- создан `vite-shell/src/features/workouts/sync/workoutPendingQueue.js`;
- вынесены чистые helpers для merge pending patches;
- вынесены helpers для queued/sending/saved/failed workout state;
- добавлен in-memory pending queue без таймеров, API и UI side effects;
- создан `vite-shell/src/features/workouts/sync/workoutSync.js`;
- добавлен sync-controller для `queuePatch`, `flushPatch`, `flushAll`, `retryPatch` поверх repository;
- создан `vite-shell/src/features/workouts/sync/workoutCachePolicy.js`;
- вынесены helpers для protected local state, pending deletes и cache fallback policy;
- создан `vite-shell/src/features/workouts/sync/workoutCache.js`;
- вынесены helpers для ключей, чтения, записи и очистки workout cache через инъекцию storage;
- добавлены структурированные sync events и нормализация ошибок для понятных logs;
- создан `vite-shell/src/features/workouts/sync/workoutLoadSync.js`;
- вынесена server-first загрузка тренировок с cache fallback, pending delete filter и protected local merge;
- создан `vite-shell/src/features/workouts/sync/workoutAutosave.js`;
- вынесен debounce/autosave scheduler поверх sync-controller без React и UI side effects;
- добавлен `pnpm run check:workout-sync`;
- legacy `index.html` пока не подключен к sync helpers.

Граница этапа:

- новый sync-слой готов как проверяемая инфраструктура;
- рабочий `index.html` не менялся и не подключался к этим модулям;
- подключение legacy-экрана к sync helpers будет отдельным явным шагом после стабилизации сервисных слоев.

Запрещено:

- возвращать ранний показ старого workout cache перед server load;
- скрывать ошибки save;
- silently drop updates.

Acceptance criteria:

- нет возврата удаленных подходов;
- нет отката completed edits;
- cache используется как fallback, а не как основной источник при доступном API;
- logs понятные.

## Этап 8. Nutrition Repository and Mapper

Статус: started, not wired.

Цель: отделить питание после стабилизации workout слоя.

Кандидаты:

- nutrition API client wrapper;
- nutrition cache;
- food item mapper;
- visual units / palm rule domain;
- nutrition day totals.

Запрещено:

- менять Supabase schema;
- менять историю питания;
- менять palm-rule UI без отдельного шага.

Начато:

- создан `vite-shell/src/features/nutrition/cache/nutritionCache.js`;
- вынесены helpers для ключей, чтения, записи, markers и очистки nutrition cache;
- добавлен `pnpm run check:nutrition-cache`;
- создан `vite-shell/src/features/nutrition/domain/nutritionDay.js`;
- вынесены helpers нормализации nutrition day, meals/items, manual totals, food markers и day totals;
- добавлен `pnpm run check:nutrition-day`;
- создан `vite-shell/src/features/nutrition/api/nutritionRepository.js`;
- вынесен thin repository для nutrition actions: load, add/update/delete item, copy recent, favorite, manual totals;
- добавлен `pnpm run check:nutrition-repository`;
- создан `vite-shell/src/features/nutrition/domain/nutritionFood.js`;
- вынесены helpers для food snapshot, classic units, visual units, palm-rule mapping, grams conversion, item totals и nutrition item payload;
- добавлен `pnpm run check:nutrition-food`;
- legacy `index.html` пока не подключен к nutrition helpers.

## Этап 9. Profile, Health, Progress Repository

Цель: отделить профиль, здоровье, замеры, настройки.

Кандидаты:

- `loadHealthForProfile`;
- `loadProgressForProfile`;
- `loadMeasurementHistoryForProfile`;
- profile updates;
- theme/settings/home state updates.

Начато:

- создан `vite-shell/src/features/profile/domain/profileData.js`;
- вынесены helpers для health logs, sleep/recovery, measurement records и progress measurement normalization;
- создан `vite-shell/src/features/profile/api/profileRepository.js`;
- вынесен thin repository для profile actions, health log, progress measurement и measurement history;
- добавлен `pnpm run check:profile-repository`;
- legacy `index.html` пока не подключен к profile helpers.

## Этап 10. Analytics Services

Цель: отделить расчеты аналитики и графиков от UI.

Кандидаты:

- period calculations;
- training load metrics;
- nutrition analytics;
- health/measurement chart data;
- student dashboard chart data.

Важно:

- training analytics зависит от workout semantics;
- переносить только после стабилизации workout mapper/repository/sync.

Начато:

- создан `vite-shell/src/features/analytics/domain/analyticsData.js`;
- вынесены helpers для analytics periods, rolling chart ranges, graph summaries и chart layout flags;
- вынесены series builders для measurements, health, nutrition и training;
- вынесены workout analytics helpers для planned / actual / expected stats и current week summary;
- добавлен `pnpm run check:analytics-domain`;
- legacy `index.html` пока не подключен к analytics helpers.

## Этап 11. UI Extraction

Цель: постепенно выносить UI-компоненты.

Порядок:

1. shared UI primitives;
2. home widgets;
3. nutrition screens;
4. analytics charts;
5. workouts UI;
6. students/trainer dashboards.

Почему workouts UI не первым:

- в нем самый высокий риск persistence regression;
- сначала нужен безопасный API/repository/mapper/sync слой.

Начато:

- создан `vite-shell/src/shared/ui/ShellStatusPanel.jsx`;
- текущая Vite-shell status panel вынесена из `App.jsx` в shared UI;
- добавлен `pnpm run check:shared-ui`;
- создан `vite-shell/src/features/home/domain/homeWidgets.js`;
- вынесены каталог Home widgets, размеры, default order, nutrition exclusivity rules и helpers cache/layout;
- создан `vite-shell/src/features/home/ui/HomeWidgetsPreview.jsx` для безопасного preview в Vite shell;
- добавлен `pnpm run check:home-widgets`;
- создан `vite-shell/src/features/nutrition/domain/nutritionScreenModel.js`;
- вынесена view model для экранов питания: итоги дня, macro rows, meal rows, palm rows и food unit preview;
- создан `vite-shell/src/features/nutrition/ui/NutritionScreensPreview.jsx` для безопасного preview в Vite shell;
- добавлен `pnpm run check:nutrition-screens`;
- создан `vite-shell/src/features/analytics/domain/analyticsChartModel.js`;
- вынесена view model для графиков аналитики: chart cards, SVG coordinates/path, labels, stats и long-period layout flag;
- создан `vite-shell/src/features/analytics/ui/AnalyticsChartsPreview.jsx` для безопасного preview в Vite shell;
- добавлен `pnpm run check:analytics-charts`;
- создан `vite-shell/src/features/workouts/domain/workoutScreenModel.js`;
- вынесена view model для экрана тренировок: calendar days, workout cards, week summary, exercise rows и set rows;
- создан `vite-shell/src/features/workouts/ui/WorkoutsPreview.jsx` для безопасного preview в Vite shell;
- добавлен `pnpm run check:workouts-ui`;
- создан `vite-shell/src/features/students/domain/studentDashboardModel.js`;
- вынесена view model для учеников и тренера: control marks 0/5..5/5, карточки учеников, access labels, analytics summary и trainer panel summary;
- создан `vite-shell/src/features/students/ui/StudentsTrainerPreview.jsx` для безопасного preview в Vite shell;
- добавлен `pnpm run check:students-dashboard`;
- legacy `index.html` пока не подключен к shared UI extraction.

## Branch and Commit Rules

Перед каждым шагом:

- `git status` должен быть чистым;
- создать короткое описание цели;
- не смешивать unrelated changes.

После каждого шага:

- smoke test;
- commit с понятным именем;
- короткий отчет.

Commit style:

- `Document migration plan`;
- `Add Vite shell`;
- `Extract shared API client`;
- `Extract workout mapper`;
- `Extract workout repository`;
- `Extract workout sync service`.

## Rollback Rules

Если шаг сломал приложение:

1. Не чинить поверх хаоса.
2. Посмотреть последний commit.
3. Если проблема в миграции, откатить только этот commit.
4. Если проблема в данных, сначала подтвердить через Supabase logs.

Безопасные точки:

- legacy backup commit: `16285a8`;
- clean architecture branch head before each step.

## What Not To Do

- Не просить: "перепиши все на Vite".
- Не переносить UI и persistence одновременно.
- Не менять Supabase Functions вместе с frontend migration.
- Не удалять `index.html`, пока Vite shell не доказал, что replacement безопасен.
- Не отключать cache полностью без fallback policy.
- Не добавлять TypeScript во все приложение одним шагом.

## Recommended Next Concrete Step

После этого плана следующий шаг:

1. Проверить Node/npm.
2. Подготовить Vite shell.
3. Сохранить legacy app как `index.legacy.html`.
4. Не переносить workout logic.

Перед этим можно сделать отдельный safety commit с этим планом.
