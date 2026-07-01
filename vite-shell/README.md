# ONLYPUMP Vite Shell

This folder is the first React + Vite migration layer.

The legacy application is still the root `index.html` file. Do not move screens
into this shell until a migration step explicitly targets one bounded module.

## Local commands

```sh
pnpm install
pnpm run dev
pnpm run build
pnpm run check:api
```

If the local shell cannot find `node`, run the same commands with the bundled
Codex Node first in `PATH`:

```sh
PATH=/Users/Artur/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm run build
```

The shell is intentionally small: it only proves that a modern build pipeline can
live next to the current app without changing runtime behavior.

## Shared modules started

- `src/shared/api/endpoints.js` stores current Edge Function endpoints.
- `src/shared/api/apiErrors.js` formats API errors without turning objects into
  `[object Object]`.
- `src/shared/api/edgeFunctionClient.js` keeps the existing request shape:
  `initData`, `action`, `payload`.
- `src/shared/api/legacyApiAdapters.js` exposes compatibility wrappers with the
  old names: `callOnlyPumpProfileApi`, `callOnlyPumpWorkoutsApi`,
  `callOnlyPumpNutritionApi`.
- Profile `load_profile` keeps the current `access_denied + profile` exception.

These modules are not wired into the legacy `index.html` yet.
See `../API_CLIENT_MIGRATION_STATUS.md` before wiring them into legacy code.

## Checks

Run `pnpm run check:api` to verify the shared API module without network calls.
It checks endpoint names, request shape, legacy event names, readable API errors,
and the current `load_profile` access-denied exception.
