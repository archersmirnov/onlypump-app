# Shared API Client Migration Status

Дата: 2026-07-01

Цель файла: зафиксировать состояние нового API-слоя перед первым подключением к
legacy `index.html`.

## Статус

Статус: prepared, not wired.

Новый API-слой существует и проверяется отдельно, но рабочее приложение всё ещё
использует старые функции внутри `index.html`.

## Что уже готово

- `vite-shell/src/shared/api/endpoints.js` - текущие Edge Function endpoints.
- `vite-shell/src/shared/api/apiErrors.js` - читаемая нормализация ошибок.
- `vite-shell/src/shared/api/edgeFunctionClient.js` - общий POST-клиент.
- `vite-shell/src/shared/api/legacyApiAdapters.js` - wrappers со старыми именами:
  - `callOnlyPumpProfileApi`;
  - `callOnlyPumpWorkoutsApi`;
  - `callOnlyPumpNutritionApi`.
- `vite-shell/scripts/check-shared-api.mjs` - быстрая проверка без сети.

## Что намеренно не сделано

- Новый API-слой не подключён к `index.html`.
- Payload shape не менялся.
- Action names не менялись.
- Supabase URLs и Edge Functions не менялись.
- Workouts persistence не переносился.
- UI не менялся.

## Проверки

Перед любым подключением API-слоя:

```sh
cd vite-shell
pnpm run check:api
pnpm run build
```

Если локальный shell не видит `node`, использовать bundled Node:

```sh
PATH=/Users/Artur/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm run check:api
PATH=/Users/Artur/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm run build
```

## Wiring Gate

Первое подключение к legacy должно быть отдельным шагом и менять только один
тип вызова.

Разрешённые варианты первого wiring:

- подключить только `callOnlyPumpProfileApi`;
- или подключить только `callOnlyPumpNutritionApi`;
- не начинать с `callOnlyPumpWorkoutsApi`, если нет отдельного решения.

Запрещено в первом wiring:

- одновременно менять workouts save/load;
- менять payload;
- менять `save_workout_patch`;
- менять mappers;
- менять UI.

## Stop Rules

Остановиться и откатить wiring, если:

- профиль перестал загружаться;
- API error снова выглядит как `[object Object]`;
- Edge Function logs показывают новые ошибки;
- тренировки начали мигать лишними записями после reload;
- сохранение тренировок изменило поведение.
