import { useState } from "react";
import {
  ALL_PREVIEW_ROUTE_ID,
  PREVIEW_ROUTES,
  getVisiblePreviewRoutes
} from "./app/previewRoutes.jsx";
import { EDGE_FUNCTION_ENDPOINTS } from "./shared/api/index.js";
import { ShellStatusPanel } from "./shared/ui/index.js";

const migrationChecks = [
  "Текущий index.html не изменен",
  "Новый React/Vite слой живет отдельно",
  "Общий API-модуль подключен без запросов к серверу"
];

const apiModulesCount = Object.keys(EDGE_FUNCTION_ENDPOINTS).length;
const routeTabs = [{ id: ALL_PREVIEW_ROUTE_ID, label: "Все" }, ...PREVIEW_ROUTES];

export default function App() {
  const [activeRouteId, setActiveRouteId] = useState(ALL_PREVIEW_ROUTE_ID);
  const visibleRoutes = getVisiblePreviewRoutes(activeRouteId);

  return (
    <main className="shell">
      <div className="shell__stack">
        <ShellStatusPanel
          eyebrow="ONLYPUMP"
          title="Vite shell готов"
          lead="Это отдельная оболочка для постепенной миграции. Рабочее приложение пока остается в корневом index.html."
          meta={`API endpoints prepared: ${apiModulesCount}`}
          checks={migrationChecks}
        />
        <nav className="shell-routes" aria-label="Vite shell preview screens">
          <p className="shell-routes__eyebrow">Preview routes</p>
          <div className="shell-routes__tabs">
            {routeTabs.map((route) => {
              const isActive = route.id === activeRouteId;

              return (
                <button
                  key={route.id}
                  type="button"
                  className={`shell-routes__tab${isActive ? " shell-routes__tab--active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => setActiveRouteId(route.id)}
                >
                  {route.label}
                </button>
              );
            })}
          </div>
        </nav>
        {visibleRoutes.map((route) => (
          <div key={route.id} data-preview-route={route.id}>
            {route.render()}
          </div>
        ))}
      </div>
    </main>
  );
}
