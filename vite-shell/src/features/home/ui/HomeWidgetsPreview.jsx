import {
  DEFAULT_HOME_WIDGETS,
  buildHomeWidgetsViewModel,
  buildHomeWidgetsViewModelFromHomeSnapshotGlobal
} from "../domain/index.js";

export function HomeWidgetsPreview({
  widgets,
  source = {},
  globalSource = globalThis,
  useLegacySnapshot = true,
  title = "Home widgets",
  lead = "Первый вынесенный слой домашнего экрана: каталог, размеры и порядок виджетов живут отдельно от legacy index.html."
}) {
  const fallbackWidgets = widgets || DEFAULT_HOME_WIDGETS;
  const fallbackViewModel = buildHomeWidgetsViewModel(source, { widgets: fallbackWidgets });
  const snapshotViewModel = useLegacySnapshot
    ? buildHomeWidgetsViewModelFromHomeSnapshotGlobal(globalSource, widgets ? { widgets } : {})
    : null;
  const viewModel = snapshotViewModel?.snapshotBridge?.hasSnapshot
    ? snapshotViewModel
    : fallbackViewModel;
  const items = viewModel.items;

  return (
    <section className="home-preview" aria-labelledby="home-preview-title">
      <div className="home-preview__header">
        <div>
          <p className="home-preview__eyebrow">UI Extraction</p>
          <h2 id="home-preview-title">{title}</h2>
          <p>{lead}</p>
        </div>
        <span className="home-preview__count">{viewModel.visibleCount}/{viewModel.catalogCount}</span>
      </div>
      <div className="home-widget-grid">
        {items.map((item) => (
          <article key={item.id} className={`home-widget-card ${item.sizeClass}`}>
            <span className="home-widget-card__size">{item.size}</span>
            <h3>{item.label}</h3>
            {item.hasValue ? <p className="home-widget-card__value">{item.valueLabel}</p> : null}
            <p>{item.description}</p>
            {item.hasValue && item.metaLabel ? (
              <p className="home-widget-card__meta">{item.metaLabel}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
