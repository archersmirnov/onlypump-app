import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const routesSource = await readFile(new URL("../src/app/previewRoutes.jsx", import.meta.url), "utf8");

for (const routeId of ["home", "nutrition", "analytics", "workouts", "students"]) {
  assert.match(routesSource, new RegExp(`id: "${routeId}"`));
  assert.match(appSource, /data-preview-route=\{route\.id\}/);
}

assert.match(routesSource, /ALL_PREVIEW_ROUTE_ID = "all"/);
assert.match(routesSource, /getVisiblePreviewRoutes/);
assert.match(appSource, /useState\(ALL_PREVIEW_ROUTE_ID\)/);
assert.match(appSource, /aria-label="Vite shell preview screens"/);
assert.match(appSource, /setActiveRouteId\(route\.id\)/);
assert.doesNotMatch(appSource, /\.\/features\/workouts\/ui\/index\.js/);

console.log("preview routes checks passed");
