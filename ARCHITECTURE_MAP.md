# ONLYPUMP Architecture Map

Дата: 2026-07-01

Цель: зафиксировать текущую архитектуру приложения перед миграцией из большого `index.html` в более безопасную структуру. Этот документ описывает, где сейчас живут экраны, данные, API, кэш, Supabase Functions и зоны риска.

Этот файл не меняет поведение приложения.

## Текущий формат проекта

Проект сейчас устроен как статическое приложение:

- `index.html` - основной фронтенд, React через inline/Babel, вся большая логика приложения в одном файле;
- `assets/` - иконки, изображения, визуальные ассеты, упражнения, мышцы, TDEE, visual units;
- `supabase/functions/` - Edge Functions;
- `supabase/migrations/` - SQL-миграции;
- `dev-server.mjs` - локальный preview server;
- `package.json` - только dev/start/preview через `dev-server.mjs`.

Git-точка восстановления:

- `16285a8 Stable backup before architecture migration` - полный рабочий снимок;
- `87b29e6 Ignore local system files` - `.gitignore` и очистка Git-индекса от локального мусора;
- рабочая ветка: `migrate-architecture`.

## Главный файл

`index.html` содержит несколько слоев одновременно:

- глобальные constants/env;
- API clients;
- domain helpers;
- mappers;
- localStorage cache;
- UI components;
- feature screens;
- root state;
- boot/load orchestration;
- sync/persistence logic.

Ключевые зоны:

| Зона | Где сейчас | Комментарий |
|---|---:|---|
| Supabase URLs/API constants | `index.html:2554` | URL и Edge Function endpoints заданы глобально |
| Profile API client | `index.html:3178` | `callOnlyPumpProfileApi` |
| Workouts API client, общий | `index.html:8065` | `callOnlyPumpWorkoutsApi` |
| Nutrition API client | `index.html:8086` | `callOnlyPumpNutritionApi` |
| Root app | `index.html:34422` | `OnlyPumpPlatform` |
| Root protected setters | `index.html:34489` | `setWorkouts`, `setNutritionDay`, `setProfile` и т.д. |
| Root boot/load orchestration | `index.html:36068`, `index.html:36170` | загрузка профиля и первичных данных |
| Screen routing map | `index.html:36322` | маппинг active screen -> component |

## Root State

Главный источник состояния сейчас находится в `OnlyPumpPlatform`.

Основные state:

- `workouts` - тренировки;
- `nutritionGoal`, `nutritionDay`, `nutritionMarkedDateKeys` - питание;
- `healthLog`, `healthLogs` - здоровье, сон, вода, шаги, настроение;
- `measurements`, `measurementRecords` - прогресс и замеры;
- `profile`, `profileStatus` - профиль и доступ;
- `homeWidgets`, `personalTrackers` - виджеты и трекеры;
- `globalSelectedDateKey` - выбранная дата для приложения.

Защитный слой уже добавлен:

- `validateOnlyPumpProfileInvariant` - `index.html:9637`;
- `validateOnlyPumpWorkoutInvariant` - `index.html:9652`;
- `validateOnlyPumpNutritionInvariant` - `index.html:9715`;
- `validateOnlyPumpHealthInvariant` - `index.html:9733`;
- `validateOnlyPumpMeasurementInvariant` - `index.html:9749`;
- `setWorkouts` с нормализацией - `index.html:34489`;
- `setNutritionGoal` - `index.html:34834`;
- `setNutritionDay` - `index.html:34849`;
- `setHealthLog` - `index.html:34866`;
- `setHealthLogs` - `index.html:34882`;
- `setMeasurements` / `setMeasurementRecords` - `index.html:34905`, `index.html:34920`;
- `setProfile` - `index.html:34929`.

Важно: этот слой защищает форму данных, но не заменяет полноценные domain/repository/sync слои.

## Boot Flow

Текущий boot flow:

1. `OnlyPumpPlatform` стартует.
2. Загружается/проверяется профиль через `onlypump-profile-api`.
3. При доступе запускаются параллельные загрузки:
   - `loadWorkoutsForProfile`;
   - `loadNutritionForProfile`;
   - `loadHealthForProfile`;
   - `loadProgressForProfile`;
   - `loadMeasurementHistoryForProfile`.
4. Данные кладутся в root state.
5. Root state передается в экраны.

Ключевые места:

- `refreshAccessStatus` - `index.html:36052`;
- первичный `bootstrapProfile` - `index.html:36103`;
- `loadWorkoutsForProfile` - `index.html:34703`;
- `loadNutritionForProfile` - `index.html:35499`;
- `loadHealthForProfile` - `index.html:35325`;
- `loadProgressForProfile` - `index.html:35355`;
- `loadMeasurementHistoryForProfile` - `index.html:35386`.

## Workouts Module

Самый сложный и рискованный модуль.

### UI

Основной экран:

- `WorkoutsPage` - `index.html:14956`.

Связанные UI:

- `ExercisePickerSheet` - `index.html:14903`;
- `WorkoutFloatingActions` - `index.html:14886`;
- exercise/media components - `index.html:5593`, `index.html:5621`, `index.html:5653`;
- swipe row - `index.html:9207`.

### Workouts local state внутри экрана

`WorkoutsPage` получает `workouts` и `setWorkouts` из root, но внутри держит много локального UI-state:

- selected workout;
- active exercise/set;
- repeat scheduler;
- completion sheet;
- rest timer;
- program builder;
- exercise library;
- pending saves;
- sync flags;
- delete/rename scopes.

Крупная зона state начинается около `index.html:15248`.

### Workouts domain helpers

Сейчас domain logic смешан с экраном и глобальными helpers:

- `normalizeWorkoutStatus` - `index.html:6506`;
- `normalizeWorkoutType` - `index.html:6548`;
- `normalizeWorkoutSupersetMetadata` - `index.html:6683`;
- `getExpectedWorkouts` - `index.html:6913`;
- `getExpectedWorkoutStats` - `index.html:6928`;
- `recalculateWorkoutTotals` - `index.html:17989`;
- `getWorkoutTotals` - `index.html:18003`.

### Workouts mapper/payload builders

Сейчас mapper и payload builders находятся внутри `WorkoutsPage`:

- `buildWorkoutSupabasePayload` - `index.html:18007`;
- `buildWorkoutPatchPayload` - `index.html:18164`;
- `buildWorkoutTotalsPatchPayload` - `index.html:18201`;
- `buildWorkoutTreePatch` - `index.html:18597`;
- `buildWorkoutTreeCreatePayload` - `index.html:18614`;
- `buildWorkoutTreeUpdatePayload` - `index.html:18639`;
- `mapSupabaseWorkout` - `index.html:19137`;
- `buildWorkoutTreeFromApi` - `index.html:19186`.

Это один из первых кандидатов на вынос в `workoutMapper`.

### Workouts repository/sync

Сейчас repository/sync логика тоже внутри `WorkoutsPage`:

- scoped API wrapper `callWorkoutsApi` - `index.html:17671`;
- `sendWorkoutPatch` - `index.html:18466`;
- `queueWorkoutPatch` - `index.html:18561`;
- create/update/delete wrappers - `index.html:18740` onward;
- `loadWorkoutsFromApi` - `index.html:19277`;
- `mergeLoadedWorkoutsWithDirtyState` - `index.html:18796`.

Недавнее защитное изменение:

- прямых `setWorkouts(prev => prev.map/filter(...))` больше нет;
- список workout теперь меняется через helpers;
- см. `SAFETY_DIRECT_WRITES_AUDIT.md`.

### Workouts cache

Кэш:

- keys/read/write - `index.html:7142`, `index.html:7155`, `index.html:7172`.

После последней правки кэш тренировок больше не рисуется перед сервером, если доступен remote API. Он остался fallback при ошибке/недоступности API.

### Workouts backend

Edge Function:

- `supabase/functions/onlypump-workouts-api/index.ts`.

Actions:

- `load`;
- `load_exercise_library`;
- `load_program_templates`;
- `load_program_template_details`;
- `load_user_programs`;
- `save_program_template`;
- `update_program_template`;
- `share_program_template`;
- `create_user_program`;
- `pause_user_program`, `resume_user_program`, `cancel_user_program`;
- `save_user_program_exercise_settings`;
- `update_user_program_settings`;
- `generate_program_workouts`, `recalculate_program_progression`;
- `create_custom_exercise`, `update_custom_exercise`;
- `exercise_history`;
- `create_workout`, `create_workout_tree`;
- `create_exercise`, `create_set`;
- `update_workout`, `update_exercise`, `update_set`;
- `delete_set`, `delete_exercise`, `delete_workout`;
- `rename_workout_scope`;
- `delete_workout_scope`, `delete_program_scope`;
- `save_workout_patch`, `update_workout_tree`.

## Nutrition Module

Основной экран:

- `NutritionPage` - `index.html:25774`;
- `ManualNutritionSheet` - `index.html:26293`.

Root загрузка:

- `loadNutritionForProfile` - `index.html:35499`.

API:

- `callOnlyPumpNutritionApi` - `index.html:8086`;
- Edge Function: `supabase/functions/onlypump-nutrition-api/index.ts`.

Nutrition cache:

- `getNutritionCacheKey` - `index.html:7283`;
- `readCachedNutritionForProfile` - `index.html:7297`;
- `writeCachedNutritionForProfile` - `index.html:7321`;
- markers - `index.html:7288`, `index.html:7309`, `index.html:7353`.

Backend actions:

- `load`, `recalculate_day`;
- `save_manual_day_totals`;
- `add_item`;
- `update_item`;
- `delete_item`;
- `toggle_favorite`;
- `copy_recent_item`.

Сейчас в питании уже есть логика visual units / palm rule, но она еще живет внутри общего файла вместе с UI.

## Home, Health, TDEE, Trackers

Home:

- `HomePage` - `index.html:13847`;
- widgets/settings - `index.html:13773`, `index.html:11960`;
- widget cache - `index.html:4126`, `index.html:4498`, `index.html:4510`.

Health editors:

- sleep - `index.html:12871`;
- steps - `index.html:12976`;
- mood/wellbeing - `index.html:13033`;
- daily note - `index.html:13100`;
- water - `index.html:13271`.

Health root API/load:

- `loadHealthForProfile` - `index.html:35325`;
- save health log - `index.html:35440`.

Health cache:

- `getHealthCacheKey` - `index.html:7362`;
- `readCachedHealthForProfile` - `index.html:7372`;
- `writeCachedHealthForProfile` - `index.html:7396`;
- `readCachedHealthLogsForProfile` - `index.html:7384`;
- `writeCachedHealthLogsForProfile` - `index.html:7404`.

TDEE:

- formulas/constants - `index.html:10941`;
- calendar/donut/detail components - `index.html:11405`, `index.html:11454`, `index.html:11684`;
- TDEE currently depends on health logs + nutrition history + workouts.

Personal trackers:

- model/cache - `index.html:4127`, `index.html:4261`, `index.html:4272`;
- UI - `index.html:13349` onward.

## Progress and Measurements

Main screen:

- `ProgressPage` - `index.html:27093`.

Editors:

- weight editor - `index.html:13158`;
- measurement editor - `index.html:13214`.

Root load/save:

- `loadProgressForProfile` - `index.html:35355`;
- `loadMeasurementHistoryForProfile` - `index.html:35386`;
- `save_progress_measurement` calls - `index.html:27251`, `index.html:35290`.

Backend:

- profile Edge Function actions `load_progress`, `save_progress_measurement`.

## Analytics Module

Main screen:

- `AnalyticsPage` - `index.html:29974`.

Detail/modal:

- `AnalyticsDetailSheet` - `index.html:29282`;
- mobile analytics - `index.html:29438`.

Charts:

- `AnalyticsChart` - `index.html:28472`;
- `WeightAnalyticsChart` - `index.html:28485`;
- `StepsAnalyticsChart` - `index.html:28662`;
- `NutritionAnalyticsChart` - `index.html:28911`;
- `DefaultAnalyticsChart` - `index.html:29138`.

Data:

- local workouts are passed into analytics from root;
- remote analytics loads through `onlypump-profile-api` action `load_analytics`;
- analytics cache - `index.html:7412`, `index.html:7417`, `index.html:7429`.

Important dependency:

- training load/sets/tonnage analytics reads workout data and is affected by workout status, set completion, and cached/remote workout consistency.

## Students / Trainer Module

Students screen:

- `StudentsPage` - `index.html:33427`.

Student dashboard:

- `TrainerStudentDashboardSheet` - `index.html:32537`;
- measurements table - `index.html:32488`.

Access/admin:

- `ProfileAccessPanelSheet` - `index.html:33816`;
- role/invite sheets - `index.html:33599`, `index.html:33671`, `index.html:33726`.

Backend:

- `onlypump-profile-api` actions:
  - `load_access_panel`;
  - `load_student_dashboard`;
  - `create_invite_link`;
  - `revoke_invite_link`;
  - `delete_invite_link`;
  - `update_user_access`;
  - `update_user_role`;
  - `update_user_roles`.

## Profile, Auth, Onboarding

Profile screen:

- `ProfilePage` - `index.html:34120`.

Auth/access:

- `AccessGateScreen` - `index.html:31505`;
- `TelegramRequiredScreen` - `index.html:31547`;
- `WebAuthScreen` - `index.html:31563`.

Profile editing:

- `ProfileEditSheet` - `index.html:31642`;
- `ProfileQuizSheet` - `index.html:31691`;
- onboarding - `index.html:31201`.

Backend:

- `onlypump-profile-api` actions:
  - `load_profile`;
  - `complete_onboarding`;
  - `update_profile`;
  - `update_nutrition_targets`;
  - `update_theme_settings`;
  - `update_analytics_card_settings`;
  - `update_home_state`;
  - `update_tutorial_state`;
  - `reset_profile_settings`, `reset_profile`.

## Supabase Structure

Functions:

- `supabase/functions/onlypump-workouts-api/index.ts`;
- `supabase/functions/onlypump-profile-api/index.ts`;
- `supabase/functions/onlypump-nutrition-api/index.ts`.

Migrations cover:

- workout measurement settings;
- nutrition tables;
- onboarding/profile targets;
- daily health logs;
- exercise library;
- programs;
- analytics/repeat groups;
- home widgets/personal trackers;
- roles/invites/student dashboard;
- custom program builder;
- palm nutrition mode;
- web auth;
- service role grants;
- TDEE;
- profile last activity;
- workout client id idempotency.

## Current Sources of Truth

| Domain | UI state | Local cache | Backend source |
|---|---|---|---|
| Profile | `profile` in root | partial profile/home/settings cache | `profiles`, profile Edge Function |
| Workouts | `workouts` in root + `WorkoutsPage` UI state | `onlypump_workouts_cache_*` fallback only | workout Edge Function + workout tables |
| Nutrition | `nutritionDay`, `nutritionGoal` | per-date nutrition cache + markers | nutrition Edge Function + nutrition tables |
| Health | `healthLog`, `healthLogs` | per-date health cache + logs cache | profile Edge Function health actions |
| Measurements | `measurements`, `measurementRecords` | analytics cache partly | profile Edge Function progress/analytics |
| Analytics | derived + remote data | analytics cache | profile Edge Function `load_analytics` |
| Students | local screen state | table format settings | profile Edge Function student/access actions |

## Main Architectural Risks

1. `index.html` mixes UI, state, domain, cache, mapper, API, and sync.
2. Workouts still contain several layers inside `WorkoutsPage`.
3. Mappers are not isolated, so `local id` / `supabase id` mistakes are easy.
4. Caches are spread through the file; some are display cache, some are fallback cache.
5. Analytics and widgets depend on workout semantics but are not isolated from workout state changes.
6. Backend actions are large monolithic Edge Function files.
7. There is no automated test layer for persistence scenarios yet.

## Migration Priority

Do not start by moving UI.

Recommended extraction order:

1. Shared API client:
   - profile/workouts/nutrition Edge Function caller;
   - error serialization;
   - auth/initData handling.
2. Workouts mapper:
   - `mapSupabaseWorkout`;
   - `buildWorkoutSupabasePayload`;
   - `buildWorkoutPatchPayload`;
   - exercise/set mapping;
   - ID handling.
3. Workouts repository:
   - load/create/update/delete operations;
   - program/exercise library operations.
4. Workouts sync:
   - queue;
   - debounce;
   - pending state;
   - retries;
   - fallback cache policy.
5. Nutrition API/repository/mapper.
6. Profile/health/progress repository.
7. Analytics data services.
8. UI components.

## Hard Rules For Next Steps

- Do not rewrite `WorkoutsPage` UI before API/mapper/repository are separated.
- Do not move Supabase functions during the first Vite shell step.
- Do not change persistence semantics while moving files.
- After each migration step, run the workout persistence checklist.
- Keep `main` as a working fallback branch.
- Do all migration work on `migrate-architecture` or smaller branches from it.
