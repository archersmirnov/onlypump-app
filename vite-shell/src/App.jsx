import { EDGE_FUNCTION_ENDPOINTS } from "./shared/api/index.js";
import { AnalyticsChartsPreview } from "./features/analytics/ui/index.js";
import { HomeWidgetsPreview } from "./features/home/index.js";
import { NutritionScreensPreview } from "./features/nutrition/ui/index.js";
import { StudentsTrainerPreview } from "./features/students/ui/index.js";
import { WorkoutsPreview } from "./features/workouts/ui/index.js";
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
      <div className="shell__stack">
        <ShellStatusPanel
          eyebrow="ONLYPUMP"
          title="Vite shell готов"
          lead="Это отдельная оболочка для постепенной миграции. Рабочее приложение пока остается в корневом index.html."
          meta={`API endpoints prepared: ${apiModulesCount}`}
          checks={migrationChecks}
        />
        <HomeWidgetsPreview />
        <NutritionScreensPreview />
        <AnalyticsChartsPreview />
        <WorkoutsPreview />
        <StudentsTrainerPreview />
      </div>
    </main>
  );
}
