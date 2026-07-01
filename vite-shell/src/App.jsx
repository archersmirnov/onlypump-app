import { EDGE_FUNCTION_ENDPOINTS } from "./shared/api/index.js";

const migrationChecks = [
  "Текущий index.html не изменен",
  "Новый React/Vite слой живет отдельно",
  "Общий API-модуль подключен без запросов к серверу"
];

const apiModulesCount = Object.keys(EDGE_FUNCTION_ENDPOINTS).length;

export default function App() {
  return (
    <main className="shell">
      <section className="shell__panel" aria-labelledby="shell-title">
        <p className="shell__eyebrow">ONLYPUMP</p>
        <h1 id="shell-title">Vite shell готов</h1>
        <p className="shell__lead">
          Это отдельная оболочка для постепенной миграции. Рабочее приложение
          пока остается в корневом index.html.
        </p>
        <p className="shell__meta">API endpoints prepared: {apiModulesCount}</p>
        <ul className="shell__checks">
          {migrationChecks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
