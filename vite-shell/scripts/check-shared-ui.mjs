import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const uiIndexSource = await readFile(new URL("../src/shared/ui/index.js", import.meta.url), "utf8");
const panelSource = await readFile(new URL("../src/shared/ui/ShellStatusPanel.jsx", import.meta.url), "utf8");

assert.match(panelSource, /export function ShellStatusPanel/);
assert.match(panelSource, /aria-labelledby=\{titleId\}/);
assert.match(panelSource, /checks\.map/);
assert.match(uiIndexSource, /ShellStatusPanel\.jsx/);
assert.match(appSource, /import \{ ShellStatusPanel \} from "\.\/shared\/ui\/index\.js"/);
assert.match(appSource, /<ShellStatusPanel/);
assert.doesNotMatch(appSource, /<section className="shell__panel"/);

console.log("shared ui checks passed");
