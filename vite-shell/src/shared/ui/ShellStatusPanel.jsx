export function ShellStatusPanel({
  eyebrow = "",
  title,
  lead,
  meta,
  checks = [],
  titleId = "shell-title"
}) {
  return (
    <section className="shell__panel" aria-labelledby={titleId}>
      {eyebrow && <p className="shell__eyebrow">{eyebrow}</p>}
      <h1 id={titleId}>{title}</h1>
      {lead && <p className="shell__lead">{lead}</p>}
      {meta && <p className="shell__meta">{meta}</p>}
      {checks.length > 0 && (
        <ul className="shell__checks">
          {checks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
