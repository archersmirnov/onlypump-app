# ONLYPUMP Vite Shell Integration Plan

Дата: 2026-07-01

Цель: подключать `vite-shell` к реальному приложению постепенно, без большой
переписи и без риска снова сломать сохранение тренировок.

Этот файл не меняет поведение приложения.

## Текущее состояние

- рабочее приложение остается в корневом `index.html`;
- `vite-shell/` уже содержит отдельные React/Vite preview-модули;
- preview route registry уже добавлен внутри `vite-shell`;
- Home, Nutrition, Analytics, Workouts и Students можно открывать отдельными
  preview-вкладками;
- shared API client существует;
- profile и nutrition уже подключены к legacy через browser bridge;
- workouts API, mapper, repository и sync вынесены, но намеренно не подключены к
  legacy `index.html`;
- Supabase Functions и schema не трогаются в рамках этого этапа.

## Главная модель подключения

`vite-shell` сначала работает как безопасная параллельная оболочка.

Не переключаем production на Vite сразу. Сначала переносим экраны по одному,
проверяя каждый слой отдельно.

Правильная последовательность:

1. Shell показывает read-only preview экрана.
2. Shell получает ту же view model, что legacy экран.
3. Shell подключается к repository/API только для чтения.
4. Только после smoke test разрешается переносить write-flow.
5. Workouts write-flow переносится последним.

## Границы

Разрешено:

- менять `vite-shell/src/**`;
- добавлять проверки в `vite-shell/scripts/**`;
- обновлять документацию миграции;
- добавлять read-only preview для экранов;
- подключать read-only data loaders отдельным шагом.

Запрещено без отдельного явного шага:

- заменять корневой `index.html`;
- менять Supabase Functions;
- менять таблицы или RLS;
- менять workout save/load/delete;
- менять payload shape API;
- переносить UI и persistence одновременно.

## Порядок экранов

1. Home widgets - read-only.
2. Analytics charts - read-only.
3. Nutrition summary - сначала read-only, write-flow позже.
4. Students/trainer dashboards - read-only.
5. Nutrition write-flow.
6. Workouts read-only.
7. Workouts write-flow - только последним и только после полного checklist.

## Gate перед каждым переносом

Перед переносом экрана:

- рабочее дерево должно быть понятным: отдельно код, отдельно assets;
- `pnpm run check` в `vite-shell` должен проходить;
- legacy `index.html` должен открываться;
- Supabase logs не должны показывать новые красные ошибки;
- выбранный экран должен иметь отдельный rollback commit.

После переноса экрана:

- проверить legacy экран;
- проверить Vite shell;
- проверить данные после reload;
- если затронуты тренировки, пройти `SAFETY_WORKOUT_PERSISTENCE_CHECKLIST.md`.

## Уже закрыто в этом этапе

- добавлен маленький navigation/route registry для preview-экранов;
- preview-экраны открываются по одному внутри `vite-shell`;
- общий preview остается доступен;
- добавлена проверка, что Vite shell не подключен к корневому `index.html` и
  preview-слой не тянет workout write-flow.
- Home preview умеет read-only читать legacy snapshot из
  `window.__ONLYPUMP_HOME_SNAPSHOT__`, если он доступен в текущем окне, и
  откатывается на preview-source, если snapshot недоступен.

## Следующий безопасный шаг

Пройти integration gate перед реальным подключением `vite-shell` к приложению:

- не менять `index.html`;
- не трогать workout persistence;
- запустить полный `pnpm run check` в `vite-shell`;
- открыть Vite preview и вручную проверить вкладки Home, Nutrition, Analytics,
  Workouts, Students;
- после этого планировать только read-only подключение первого безопасного
  экрана.

Acceptance criteria следующего шага:

- `pnpm run check` проходит;
- legacy `index.html` не меняется;
- preview route tabs работают;
- нет изменений в Supabase/API;
- нет изменений в workout save/load/delete.
