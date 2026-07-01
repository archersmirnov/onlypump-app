import { EDGE_FUNCTION_ENDPOINTS } from "./shared/api/index.js";
import { ShellStatusPanel } from "./shared/ui/index.js";

const migrationChecks = [
  "Текущий index.html не изменен",
  "Новый React/Vite слой живет отдельно",
  "Общий API-модуль подключен без запросов к серверу"
];

const apiModulesCount = Object.keys(EDGE_FUNCTION_ENDPOINTS).length;

export default function App() {
  return (
    <main className="shell">
      <ShellStatusPanel
        eyebrow="ONLYPUMP"
        title="Vite shell готов"
        lead="Это отдельная оболочка для постепенной миграции. Рабочее приложение пока остается в корневом index.html."
        meta={`API endpoints prepared: ${apiModulesCount}`}
        checks={migrationChecks}
      />
    </main>
  );
}
