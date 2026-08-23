export function PropertySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="property-section"><h3>{title}</h3>{children}</section>;
}

export function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="property-row"><span aria-hidden="true">{label}</span><div className="property-control">{children}</div></div>;
}
