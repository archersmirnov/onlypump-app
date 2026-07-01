import {
  DEFAULT_HOME_WIDGETS,
  HOME_WIDGET_CATALOG,
  buildHomeWidgetPreviewItems
} from "../domain/index.js";

export function HomeWidgetsPreview({
  widgets = DEFAULT_HOME_WIDGETS,
  title = "Home widgets",
  lead = "Первый вынесенный слой домашнего экрана: каталог, размеры и порядок виджетов живут отдельно от legacy index.html."
}) {
  const items = buildHomeWidgetPreviewItems(widgets);

  return (
    <section className="home-preview" aria-labelledby="home-preview-title">
      <div className="home-preview__header">
        <div>
          <p className="home-preview__eyebrow">UI Extraction</p>
          <h2 id="home-preview-title">{title}</h2>
          <p>{lead}</p>
        </div>
        <span className="home-preview__count">{items.length}/{HOME_WIDGET_CATALOG.length}</span>
      </div>
      <div className="home-widget-grid">
        {items.map((item) => (
          <article key={item.id} className={`home-widget-card ${item.sizeClass}`}>
            <span className="home-widget-card__size">{item.size}</span>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
