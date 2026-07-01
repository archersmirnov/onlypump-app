# ONLYPUMP Codex Rules

## Project structure
- Main app is currently in `index.html`.
- This is a React/Tailwind single-file prototype.
- Avoid large rewrites unless explicitly requested.

## Work rules
- Before editing, identify exact components/functions that will be changed.
- Do not repeatedly search for the same symbols. Search once, then proceed.
- Prefer small targeted patches.
- Do not change backend/API/Supabase unless explicitly requested.
- Do not change desktop behavior when the task is mobile-only.
- Do not introduce new dependencies.

## Validation
After editing:
- Check for syntax errors.
- Check for conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`.
- Summarize changed components/functions.
- Explain how to manually test the change.

## If context is compressed
- Do not restart the whole investigation.
- Continue from the last concrete file/function found.
- If no concrete progress was made, stop and report that the task should be split.
