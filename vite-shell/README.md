# ONLYPUMP Vite Shell

This folder is the first React + Vite migration layer.

The legacy application is still the root `index.html` file. Do not move screens
into this shell until a migration step explicitly targets one bounded module.

## Local commands

```sh
pnpm install
pnpm run dev
pnpm run build
```

If the local shell cannot find `node`, run the same commands with the bundled
Codex Node first in `PATH`:

```sh
PATH=/Users/Artur/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm run build
```

The shell is intentionally small: it only proves that a modern build pipeline can
live next to the current app without changing runtime behavior.
