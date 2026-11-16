"use client";

import { useState } from "react";

const TONES = ["var(--red)", "var(--green)", "var(--brown)", "var(--deep)"];

type Action = "pin" | "quitar";

const COPY: Record<Action, { ask: string; confirm: string }> = {
  pin: { ask: "Restablecer PIN", confirm: "Podrá elegir un PIN nuevo al entrar. Si el sorteo ya estaba hecho, se reabre." },
  quitar: { ask: "Quitar", confirm: "Se borra su cuenta y su lista. Si el sorteo ya estaba hecho, se reabre." },
};

/** One person in the group list. The organizer gets reset-PIN and remove actions, each with an inline confirmation. */
export default function MemberRow({
  name,
  ready,
  resetPending,
  index,
  isSelf,
  canManage,
  busy,
  onAction,
}: {
  name: string;
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
    border: "1.5px solid var(--line)",
    borderRadius: 999,
    background: "var(--card)",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--ink)",
    cursor: "pointer",
  };

  return (
    <li style={{ padding: "9px 0", listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", background: TONES[index % 4], color: "#fff", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {name.charAt(0).toUpperCase()}
        </span>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>
          {name}
          {isSelf && <span style={{ color: "var(--muted)", fontWeight: 500 }}> (tú)</span>}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: ready ? "var(--ok)" : "var(--muted)" }}>{resetPending ? "Elegirá PIN nuevo" : ready ? "Lista" : "Pendiente"}</span>
      </div>

      {canManage && !pending && (
        <div style={{ display: "flex", gap: 8, paddingLeft: 46 }}>
          <button type="button" style={small} disabled={busy} onClick={() => setPending("pin")}>Restablecer PIN</button>
          <button type="button" style={small} disabled={busy} onClick={() => setPending("quitar")}>Quitar</button>
        </div>
      )}

      {canManage && pending && (
        <div role="group" aria-label={`Confirmar: ${COPY[pending].ask} a ${name}`} style={{ paddingLeft: 46, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.35 }}>{COPY[pending].confirm}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...small, background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" }} disabled={busy}
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
