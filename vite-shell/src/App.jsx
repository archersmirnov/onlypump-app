const migrationChecks = [
  "Текущий index.html не изменен",
  "Новый React/Vite слой живет отдельно",
  "Следующие переносы будут маленькими и проверяемыми"
];

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
        <ul className="shell__checks">
          {migrationChecks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
