# Аудит прямых записей в общие данные OnlyPump

Дата: 2026-07-01

Цель: зафиксировать места, где экраны и обработчики напрямую меняют общие данные приложения. Это нужно, чтобы следующие правки делать не вслепую: сначала знать, где экран просто рисует UI, а где он фактически меняет тренировку, питание, профиль, аналитику или виджеты.

Этот файл не меняет поведение приложения.

## Что уже защищено

В корневом `OnlyPumpPlatform` уже есть мягкий слой защиты записи:

- `setWorkouts`
- `setNutritionGoal`
- `setNutritionDay`
- `setHealthLog`
- `setHealthLogs`
- `setMeasurements`
- `setMeasurementRecords`
- `setProfile`

Эти setters проверяют форму данных и пишут предупреждения `[OnlyPumpDataEntry]`, если в общий state пытаются положить неправильный тип или подозрительную структуру.

Также есть диагностические окна:

- `window.__ONLYPUMP_DATA_INVARIANTS__`
- `window.__ONLYPUMP_DOMAIN_EVENTS__`

Важно: это защищает форму данных, но не гарантирует правильный смысл действия. Например, setter может принять валидный массив `workouts`, но этот массив может быть логически неправильным: без удаленного подхода, со старым статусом или с неверным expected/actual объемом.

## Выполнено после аудита

Первый маленький кодовый шаг сделан 2026-07-01:

- добавлены чистые helpers для списка тренировок, упражнений и подходов;
- переведены центральные `patchWorkoutInState`, `patchExerciseInState`, `patchSetInState`;
- переведены одиночное переименование и одиночное удаление тренировки;
- переведены часть удаления упражнения и подхода;
- переведены старт тренировки, завершение тренировки и сохранение настроек упражнения;
- переведено добавление упражнений в выбранную тренировку;
- переведены оставшиеся bulk-обновления списка тренировок: ошибка создания программы, групповое переименование и прогрессия будущих тренировок;
- прямых `setWorkouts(prev => prev.map/filter(...))` в файле больше не осталось;
- API payload, Supabase, UI и бизнес-логика сохранения не менялись.

## Главная зона риска: тренировки

### Где живут прямые записи

`WorkoutsPage` получает `workouts` и `setWorkouts` из корня и внутри себя делает много прямых изменений:

- создание тренировки;
- добавление программы в расписание;
- повтор тренировки;
- переименование;
- удаление;
- изменение упражнения;
- изменение подхода;
- добавление подхода;
- удаление подхода;
- изменение статуса;
- завершение тренировки;
- применение ответа API;
- откат optimistic update при ошибке.

Ключевые участки:

- `addWorkoutForDate`
- `addProgramToWorkouts`
- `duplicateWorkout`
- `renameWorkoutOnly`
- `applyWorkoutRenameScope`
- `deleteWorkoutOnly`
- `applyWorkoutDeleteScope`
- `patchWorkoutInState`
- `patchExerciseInState`
- `patchSetInState`
- `markWorkoutDirty`
- `sendWorkoutPatch`
- `queueWorkoutPatch`
- `updateWorkoutSet`
- `updateSelectedWorkoutModel`
- `removeActiveExercise`
- `removeExerciseFromSelectedWorkout`
- `addSetToActiveExercise`
- `removeSetFromActiveExercise`

### Что безопасно оставить сейчас

Безопасно оставить как есть:

- `setWorkouts` в корневой загрузке тренировок, потому что там данные нормализуются после API/cache;
- `patchWorkoutInState`, потому что это уже центральная точка обновления одной тренировки;
- `updateSelectedWorkoutModel`, потому что это уже почти правильный доменный helper для редактирования выбранной тренировки;
- `queueWorkoutPatch` / `sendWorkoutPatch`, потому что они централизуют autosave.

### Что рискованно

Рискованные прямые записи:

- места, где `setWorkouts(...)` вызывается рядом с ручным `writeCachedWorkoutsForProfile(...)`;
- места, где optimistic update сразу удаляет workout/exercise/set до подтверждения API;
- места, где при ошибке вручную возвращается `previousWorkouts`;
- места, где `selectedWorkout` и `workouts` обновляются двумя отдельными вызовами;
- места, где добавляется/удаляется set или exercise, а потом отдельно собирается patch для API.

Именно в таких местах раньше могли появляться симптомы:

- удаленный подход возвращается;
- completed-тренировка визуально изменилась, но после reload откатилась;
- повтор создал тренировку, но дальнейшие изменения не сохранялись;
- active/completed/planned расходились между UI и базой.

### Следующий безопасный шаг по тренировкам

Не переписывать `WorkoutsPage` целиком.

Лучший следующий шаг:

1. Ввести 3-4 маленьких helper-функции рядом с текущими workout helpers:
   - `replaceWorkoutInList(workouts, workoutId, patcher)`
   - `removeWorkoutFromList(workouts, workoutId)`
   - `replaceExerciseInWorkout(workout, exerciseId, patcher)`
   - `replaceSetInExercise(exercise, setId, patcher)`
2. Перевести только самые частые прямые `map/filter` внутри `WorkoutsPage` на эти helpers.
3. Не менять payload API.
4. Не менять UI.
5. После каждого перевода прогонять сценарий из `SAFETY_CRITICAL_SCENARIOS.md`.

Это уменьшит риск расхождения между `selectedWorkout`, `workouts`, cache и API-patch.

## Питание

### Где живут прямые записи

Основная модель правильнее, чем в тренировках: `NutritionPage` в основном вызывает `onNutritionAction`, а фактическая запись проходит через корневой `handleNutritionAction`.

Ключевые участки:

- `NutritionPage`
- `openFoodDraft`
- `saveManualNutritionTotals`
- `handleNutritionAction`
- `applyNutritionDay`
- `loadNutritionForProfile`

### Что безопасно оставить сейчас

Безопасно оставить:

- `NutritionPage` как UI-слой, если он продолжает вызывать `onNutritionAction`;
- `handleNutritionAction` как центральный вход записи;
- локальный optimistic update внутри `handleNutritionAction`, потому что там есть откат `previousDay`.

### Что рискованно

Рискованные места:

- `setNutritionGoal(day.goal)` внутри `NutritionPage`;
- любые будущие прямые `setNutritionDay(...)` внутри UI вместо `onNutritionAction`;
- смешение `nutritionDay` текущей даты и истории питания по датам;
- TDEE/TEF, если он берет питание не через date-aware источник.

### Следующий безопасный шаг по питанию

Добавить helpers:

- `getNutritionDayForDate(dateKey, fallbackGoal)`
- `applyNutritionActionToDay(day, action, payload)`
- `getNutritionDayMarkerState(day)`

И постепенно следить, чтобы UI не писал `nutritionDay` напрямую.

## Профиль

### Где живут прямые записи

Профиль меняется в корне через:

- `applyProfileState`
- `handleSaveProfile`
- `handleSaveThemeSettings`
- `handleSaveAnalyticsCardSettings`
- `handleSaveHomeState`
- `handleResetProfileSettings`
- `handleProgressProfileSaved`

### Что безопасно оставить сейчас

Безопасно оставить:

- `applyProfileState` как единый вход применения профиля;
- `handleSaveProfile`, потому что он уже пишет через `applyProfileState`;
- `handleProgressProfileSaved`, потому что он тоже проходит через `applyProfileState`.

### Что рискованно

Рискованные места:

- `applyProfileState` одновременно меняет `profile`, `measurements`, `progressGoal`, `nutritionGoal`, иногда `nutritionDay`;
- `handleSaveHomeState` пишет `setProfile(...)` отдельно от `applyProfileState`;
- изменения профиля могут незаметно поменять питание/TDEE/виджеты.

### Следующий безопасный шаг по профилю

Разделить смысл внутри `applyProfileState` не по файлам, а по маленьким внутренним helpers:

- `deriveMeasurementsFromProfile(profile, previousMeasurements)`
- `deriveProgressGoalFromProfile(profile, previousGoal)`
- `deriveNutritionGoalFromProfile(profile, previousGoal)`
- `applyProfileToNutritionDay(day, goal, fromDate)`

Сначала добавить helpers, потом заменить только внутренности `applyProfileState`.

## Замеры и прогресс

### Где живут прямые записи

Есть два источника:

- `ProgressPage` со своим локальным `progressMeasurements`;
- корневые `measurements` и `measurementRecords`.

Ключевые участки:

- `applyProgressResponse`
- `saveProgress`
- `updateMeasurement`
- `handleSaveWeightMeasurement`
- `loadProgressForProfile`
- `loadMeasurementHistoryForProfile`

### Что безопасно оставить сейчас

Безопасно оставить:

- `applyProgressResponse`, потому что он уже сводит remote response в профиль/замеры;
- `handleSaveWeightMeasurement`, потому что он пишет optimistic record и потом применяет ответ API.

### Что рискованно

Рискованные места:

- карточки могут читать `measurements`, а графики `measurementRecords`;
- `ProgressPage` держит локальный `progressMeasurements`, который может расходиться с корнем;
- fallback из профиля может выглядеть как настоящий замер за дату.

### Следующий безопасный шаг по замерам

Добавить helpers:

- `getCurrentMeasurementSnapshot(measurements, profile)`
- `mergeMeasurementRecord(records, record)`
- `getMeasurementRecordForDate(records, dateKey)`

И потом использовать их в графиках и карточках.

## Здоровье

### Где живут прямые записи

Ключевые участки:

- `loadHealthForProfile`
- `handleSaveHealthLog`
- health sheets на главной через `onSaveHealthLog`

### Что безопасно оставить сейчас

Безопасно оставить:

- `handleSaveHealthLog` как единый вход записи;
- optimistic update в `handleSaveHealthLog`, потому что он сразу нормализует дату.

### Что рискованно

Рискованные места:

- `healthLog` текущего дня и `healthLogs` истории могут расходиться;
- timezone/dateKey;
- TDEE может взять шаги не за ту дату.

### Следующий безопасный шаг по здоровью

Добавить helpers:

- `getHealthLogForDate(healthLog, healthLogs, dateKey)`
- `mergeHealthLog(history, log)`
- `getStepsForDate(healthLog, healthLogs, dateKey)`

## Виджеты и аналитика

### Почему это отдельный риск

Виджеты и аналитика часто не пишут данные, но читают те же общие объекты:

- `workouts`
- `nutritionDay`
- `healthLog`
- `healthLogs`
- `measurements`
- `measurementRecords`
- `profile`

Из-за этого визуальная правка карточки может случайно поменять смысл метрики, если она читает сырые данные напрямую.

### Особо важное правило

Для тренировок нужно явно разделять:

- фактическое: completed;
- плановое: planned;
- ожидаемое за неделю: completed + planned, если экран так задуман.

Нельзя, чтобы аналитика фактического объема случайно считала planned.

## Приоритет следующего кода

Самый безопасный порядок:

1. Добавить чистые workout-list helpers без изменения UI.
2. Перевести 2-3 самых частых `setWorkouts(prev => prev.map(...))` на эти helpers.
3. Проверить редактирование подходов и упражнений.
4. Добавить nutrition date helpers.
5. Добавить measurement snapshot helpers.

Не делать следующим шагом:

- не выносить весь `WorkoutsPage` в отдельный файл;
- не переписывать persistence;
- не менять Supabase/API;
- не менять дизайн;
- не менять все setters за один проход.
