# Карта границ данных OnlyPump

Дата: 2026-07-01

Цель этого документа: зафиксировать, какие общие данные приложения сейчас живут в корневом `App`, какие экраны их читают и меняют, и где самый высокий риск случайно сломать сохранение, аналитику или виджеты при UI-правках.

Это диагностический документ. Он не меняет поведение приложения.

## Центральные состояния

Главные общие состояния находятся в `index.html` внутри `App`:

- `globalSelectedDateKey`
- `workouts`
- `nutritionGoal`
- `nutritionDay`
- `nutritionMarkedDateKeys`
- `healthLog`
- `healthLogs`
- `progressGoal`
- `measurements`
- `measurementRecords`
- `measurementOverlay`
- `profile`
- `profileStatus`
- `homeWidgets`
- `personalTrackers`

Они передаются в экраны в одном общем месте:

- `HomePage`
- `WorkoutsPage`
- `NutritionPage`
- `ProgressPage`
- `AnalyticsPage`
- `ProfilePage`

Из-за этого экран может выглядеть как "просто UI", но фактически менять данные, которые потом используют другие экраны.

## Домены риска

| Домен | Где живет состояние | Кто пишет | Кто читает | Где сохраняется | Главный риск |
|---|---|---|---|---|---|
| Тренировки | `workouts` | `WorkoutsPage`, загрузка из API/cache | `HomePage`, `ProgressPage`, `AnalyticsPage`, TDEE, туры | `onlypump-workouts-api`, прямой rescue load из Supabase, localStorage cache | UI-правка может поменять факт/план, повторы, удаление подходов, тоннаж, аналитику |
| Питание | `nutritionDay`, `nutritionGoal`, `nutritionMarkedDateKeys` | `NutritionPage`, `handleNutritionAction`, загрузка питания | `HomePage`, `AnalyticsPage`, TDEE | `onlypump-nutrition-api`, localStorage cache | Легко спутать текущий день и историю по датам; TEF/калории могут считаться не за ту дату |
| Здоровье | `healthLog`, `healthLogs` | health sheets, `handleSaveHealthLog`, загрузка здоровья | `HomePage`, `AnalyticsPage`, TDEE | `onlypump-profile-api`, localStorage cache | Дата/timezone и текущий лог против истории; шаги/сон/вода могут расходиться |
| Замеры | `measurements`, `measurementRecords`, `measurementOverlay` | `ProgressPage`, analytics editors, profile load | `HomePage`, `ProgressPage`, `AnalyticsPage`, trainer analytics | `onlypump-profile-api`, analytics cache | Текущий замер и история замеров могут расходиться; графики и карточки берут разные источники |
| Профиль | `profile`, `profileStatus` | onboarding, profile edit, access refresh | Почти все экраны | `onlypump-profile-api`, localStorage-derived fallbacks | Меняет цели, единицы, формулы TDEE, питание, доступ, виджеты |
| Главная / виджеты | `homeWidgets`, `personalTrackers` | `HomePage`, home-state save | `HomePage`, analytics/control flows | `update_home_state`, localStorage cache | UI-перестановка виджетов может тронуть персональные трекеры и сохранение home state |
| Прогресс | `progressGoal`, `measurements` | `ProgressPage`, profile/progress load | `ProgressPage`, `HomePage`, `AnalyticsPage` | `save_progress_measurement`, profile update | Цель и замеры связаны с профилем и аналитикой, но меняются из отдельного экрана |

## Самые опасные связи

### 1. `workouts`

Сейчас `workouts` одновременно является:

- данными для экрана тренировок;
- локальным источником для optimistic UI;
- данными для сохранения;
- источником планового и фактического тоннажа;
- источником аналитики;
- источником виджетов;
- источником TDEE-расхода от тренировок.

Нужно первым делом закрепить смысловые selectors:

- `getActualWorkouts(workouts, range)`
- `getPlannedWorkouts(workouts, range)`
- `getExpectedWorkouts(workouts, range)`
- `getActualWorkoutStats(workouts, range)`
- `getExpectedWorkoutStats(workouts, range)`
- `getWorkoutPersistenceModel(workout)`

### 2. `nutritionDay`

Риск похожий: `nutritionDay` часто означает "текущий выбранный день", но часть логики на самом деле требует историю по датам.

Нужны selectors:

- `getNutritionDayForDate(dateKey)`
- `getNutritionTotalsForDate(dateKey)`
- `getNutritionHistoryRange(startKey, endKey)`
- `getTefForDate(dateKey)`

### 3. `healthLog` / `healthLogs`

Риск: текущий health log и история логов могут использоваться вперемешку.

Нужны selectors:

- `getHealthLogForDate(dateKey)`
- `getStepsForDate(dateKey)`
- `getSleepForDate(dateKey)`
- `getRecoveryForDate(dateKey)`
- `getHealthRange(startKey, endKey)`

### 4. `measurements` / `measurementRecords`

Риск: карточки могут брать текущий объект `measurements`, а графики и таблицы - историю `measurementRecords`.

Нужны selectors:

- `getMeasurementForDate(dateKey)`
- `getLatestMeasurementBefore(dateKey)`
- `getMeasurementRange(startKey, endKey)`
- `getProgressMeasurementSnapshot(dateKey)`

### 5. `profile`

Профиль влияет почти на все формулы, поэтому для него нужны selectors, а не прямое чтение полей в каждом экране.

Нужны selectors:

- `getProfileTargets(profile)`
- `getProfileUnits(profile)`
- `getProfileTdeeInputs(profile)`
- `getProfileNutritionMode(profile)`
- `getProfileAccessState(profileStatus, profile)`

## Правило для следующих правок

Перед изменением любого экрана нужно ответить на 4 вопроса:

1. Какие домены данных этот экран читает?
2. Какие домены данных этот экран пишет?
3. Есть ли у этого домена selector, который задает смысл?
4. Есть ли regression-сценарий после изменения?

Если selector отсутствует, лучше сначала добавить маленький selector и перевести только одно место на него, чем менять расчеты прямо внутри UI.

## Первый безопасный порядок работ

1. Не трогая UI, добавить selectors для `workouts`: факт, план, ожидаемая неделя.
2. Перевести только недельный блок тренировок на эти selectors.
3. Перевести домашние виджеты "Тоннаж" и "Подходы" на те же selectors, сохранив разделение факт/план.
4. Проверить, что `AnalyticsPage` продолжает считать только фактические completed-тренировки.
5. После этого повторить такой же подход для `nutritionDay`: текущий день отдельно, история по датам отдельно.

## Минимальный regression checklist

После любой правки в домене тренировок:

- создать тренировку;
- повторить тренировку;
- изменить вес и повторы;
- удалить подход;
- удалить упражнение;
- завершить тренировку;
- перезагрузить приложение;
- проверить, что база и UI показывают одинаковое состояние;
- проверить домашние виджеты "Тоннаж" и "Подходы";
- проверить аналитику за день/неделю.

После любой правки в домене питания:

- добавить еду в текущий день;
- переключить дату;
- добавить еду в другой день;
- вернуться назад;
- проверить дневные итоги;
- проверить TDEE/TEF;
- проверить аналитику питания.

После любой правки в домене замеров/здоровья:

- сохранить замер/шаги/сон/воду;
- переключить дату;
- проверить главную;
- проверить аналитику;
- проверить графики.

