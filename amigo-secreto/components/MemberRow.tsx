"use client";

import { useState } from "react";

const TONES = ["var(--pine)", "var(--red)", "var(--green)", "var(--berry)"];

type Action = "pin" | "quitar";

const COPY: Record<Action, { ask: string; confirm: string }> = {
  pin: { ask: "Restablecer PIN", confirm: "Podrá elegir un PIN nuevo al entrar. Si el sorteo ya estaba hecho, se reabre." },
  quitar: { ask: "Quitar", confirm: "Se borra su cuenta y su lista. Si el sorteo ya estaba hecho, se reabre." },
};

/** One person in the album. Joined people are stickers, the rest are empty numbered slots. The organizer gets reset-PIN and remove actions. */
export default function MemberRow({
  name,
  claimed,
  ready,
  resetPending,
  index,
  isSelf,
  canManage,
  busy,
  onAction,
}: {
  name: string;
  claimed: boolean;
  ready: boolean;
  resetPending: boolean;
  index: number;
  isSelf: boolean;
  canManage: boolean;
  busy: boolean;
  onAction: (a: Action) => void;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const small: React.CSSProperties = {
    minHeight: 44,
    padding: "0 12px",
    border: "2px solid var(--ink)",
    borderRadius: 12,
    background: "var(--white)",
    font: "inherit",
    fontSize: 13,
    fontWeight: 800,
    color: "var(--ink)",
    cursor: "pointer",
  };
  const label = !claimed ? "Sin unirse" : resetPending ? "Elegirá PIN nuevo" : ready ? "Lista" : "Pendiente";

  const cls = !claimed ? "status" : resetPending ? "status wait" : ready ? "status ok" : "status";

  return (
    <li className="person">
      <div className="person-main">
        <span className="avatar" aria-hidden="true" style={{ background: claimed ? TONES[index % TONES.length] : "#b7cdbf" }}>
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="person-name">
          {name}
          {isSelf && <span style={{ color: "var(--muted)", fontWeight: 500 }}> (tú)</span>}
        </span>
        <span className={cls}>{label}</span>
      </div>

      {canManage && !pending && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 50 }}>
          {claimed && <button type="button" style={small} disabled={busy} onClick={() => setPending("pin")}>Restablecer PIN</button>}
          <button type="button" style={small} disabled={busy} onClick={() => setPending("quitar")}>Quitar</button>
        </div>
      )}

      {canManage && pending && (
        <div role="group" aria-label={`Confirmar: ${COPY[pending].ask} a ${name}`} style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 50 }}>
          <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.35 }}>{COPY[pending].confirm}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={{ ...small, background: "var(--ink)", color: "#fff" }} disabled={busy}
              onClick={() => { const a = pending; setPending(null); onAction(a); }}>
              Confirmar: {COPY[pending].ask}
            </button>
            <button type="button" style={small} onClick={() => setPending(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </li>
  );
}
