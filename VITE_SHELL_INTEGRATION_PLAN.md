# ONLYPUMP Vite Shell Integration Plan

Дата: 2026-07-01

Цель: подключать `vite-shell` к реальному приложению постепенно, без большой
переписи и без риска снова сломать сохранение тренировок.

Этот файл не меняет поведение приложения.

## Текущее состояние

- рабочее приложение остается в корневом `index.html`;
- `vite-shell/` уже содержит отдельные React/Vite preview-модули;
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

## Следующий безопасный шаг

Добавить в `vite-shell` маленький navigation/route registry для preview-экранов:

- без подключения реального production route;
- без изменения `index.html`;
- без Supabase изменений;
- без workout persistence;
- только чтобы каждый вынесенный экран можно было проверять отдельно.

Acceptance criteria следующего шага:

- preview-экраны открываются по одному внутри `vite-shell`;
- общий preview остается доступен;
- `pnpm run check` проходит;
- legacy `index.html` не меняется.
