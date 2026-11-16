export type WishDraft = { title: string; price: string; link: string };
export type WishErrors = Partial<Record<"title" | "price" | "link", string>>;

const BADGE = ["tone-red", "tone-green", "tone-brown"];

/** One of the three wish cards from the sketch: title, price and an optional link. */
export default function WishCard({
  index,
  value,
  errors,
  disabled,
  onChange,
}: {
  index: number;
  value: WishDraft;
  errors: WishErrors;
  disabled?: boolean;
  onChange: (patch: Partial<WishDraft>) => void;
}) {
  const n = index + 1;
  const field = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    minHeight: 46,
    border: "none",
    borderRadius: 14,
    padding: "0 14px",
    font: "inherit",
    fontSize: 16,
    background: "var(--bg)",
    color: "var(--ink)",
    width: "100%",
    ...extra,
  });
  const bad = (e?: string) => (e ? { border: "2px solid var(--deep)", background: "var(--card)" } : {});
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className={BADGE[index]} style={{ width: 30, height: 30, borderRadius: "50%", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {n}
        </span>
        <label htmlFor={`g${n}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
          Regalo {n}
        </label>
      </div>
      <input id={`g${n}`} type="text" maxLength={120} placeholder="Ej: una planta, una taza" style={field({ fontWeight: 600, ...bad(errors.title) })}
        value={value.title} disabled={disabled} aria-invalid={errors.title ? true : undefined}
        onChange={(e) => onChange({ title: e.target.value })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <label htmlFor={`p${n}`} className="sr-only">Precio del regalo {n}</label>
        <input id={`p${n}`} type="text" inputMode="numeric" placeholder="Precio, ej: $48.000" style={field({ fontSize: 15, ...bad(errors.price) })}
          value={value.price} disabled={disabled} aria-invalid={errors.price ? true : undefined}
          onChange={(e) => onChange({ price: e.target.value })} />
        <label htmlFor={`l${n}`} className="sr-only">Enlace del regalo {n}</label>
        <input id={`l${n}`} type="text" inputMode="url" autoCapitalize="none" maxLength={500} placeholder="Enlace (opcional)" style={field({ fontSize: 15, ...bad(errors.link) })}
          value={value.link} disabled={disabled} aria-invalid={errors.link ? true : undefined}
          onChange={(e) => onChange({ link: e.target.value })} />
      </div>
      {(errors.title || errors.price || errors.link) && (
        <span role="alert" className="error">{errors.price ?? errors.title ?? errors.link}</span>
      )}
    </div>
  );
}
