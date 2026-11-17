"use client";

import { useState } from "react";
import Link from "next/link";
import Bubble from "@/components/Bubble";
import Clouds from "@/components/Clouds";
import Field from "@/components/Field";
import Pack from "@/components/Pack";
import { apiFetch } from "@/lib/client/api";
import { unlockPrivateKey } from "@/lib/client/session";
import { useMe, type Me } from "@/lib/client/useMe";
import { openPayload } from "@/lib/crypto/hybrid";
import { formatCop } from "@/lib/cop";
import { safeHref } from "@/lib/links";

type Result = { receiverName: string; wishes: { title: string; price: number; link?: string; details?: string }[] };

const TONES = ["tone-red", "tone-green", "tone-brown"];

function Reveal({ me }: { me: Me }) {
  const [asking, setAsking] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let key: CryptoKey;
      try {
        key = await unlockPrivateKey(pin, me, me.salt);
      } catch {
        setError("Ese PIN no es el tuyo. Intenta de nuevo.");
        setBusy(false);
        return;
      }
      const r = await apiFetch<{ sealed: string }>("/api/result");
      if (!r.ok) {
        setError(r.error);
        setBusy(false);
        return;
      }
      setResult(await openPayload<Result>(r.data.sealed, key)); // decrypted here, in this browser only
      setAsking(false);
      setPin("");
    } catch {
      setError("No pudimos abrir tu resultado. Si quien organiza repitió el sorteo, vuelve a entrar e intenta de nuevo.");
    }
    setBusy(false);
  }

  function hide() {
    setResult(null);
    setPin("");
    setAsking(false);
    setError(null);
  }

  if (!me.group.drawDone) {
    return (
      <div className="stack" style={{ gap: 14 }}>
        <h1>El sorteo aún no se ha hecho</h1>
        <p className="lede">Cuando quien organiza lo haga, vuelve aquí para ver a quién le regalas.</p>
        <Link href="/grupo" className="btn btn-primary">Volver al grupo</Link>
      </div>
    );
  }

  if (result) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="anim-pop stack" style={{ gap: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--muted)" }}>Le regalas a</span>
          <span className="reveal">{result.receiverName}</span>
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>Sus tres deseos</h2>
        <ul className="stack" style={{ gap: 12, listStyle: "none", padding: 0 }}>
          {result.wishes.map((w, i) => {
            const href = safeHref(w.link ?? null);
            return (
              <li key={i} className="card" style={{ borderRadius: 22, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span className={TONES[i % 3]} style={{ width: 32, height: 32, borderRadius: "50%", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.25, overflowWrap: "anywhere", paddingTop: 3 }}>{w.title}</span>
                </div>
                <span className="chip tone-green" style={{ alignSelf: "flex-start" }}>{formatCop(w.price)} COP</span>
                {w.details && <p style={{ fontSize: 15, lineHeight: 1.4, overflowWrap: "anywhere", margin: 0 }}>{w.details}</p>}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ textDecoration: "none", fontWeight: 700 }}>
                    Ver el regalo
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <Bubble tone="green" style={{ alignSelf: "flex-end", maxWidth: 250 }}>Shh, solo tú puedes ver esto</Bubble>
        <Link href="/chat" className="btn btn-primary push">Escribirle de forma anónima</Link>
        <button type="button" className="btn btn-ghost" onClick={hide}>Ocultar</button>
      </div>
    );
  }

  return (
    <form onSubmit={reveal} noValidate style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
      <h1 style={{ textAlign: "center" }}>¿Listo para saber a quién le regalas?</h1>
      <div style={{ flex: 1, width: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
        <Bubble tone="yellow" style={{ position: "absolute", right: 0, top: 10, maxWidth: 200, zIndex: 2 }}>Mira que nadie esté viendo tu pantalla</Bubble>
        <Pack />
      </div>
      {asking && (
        <div style={{ width: "100%" }} className="stack">
          <Field id="pin" label="Escribe tu PIN para abrir tu resultado" type="password" autoComplete="current-password" autoFocus
            value={pin} onChange={(e) => setPin(e.target.value)} error={error} />
        </div>
      )}
      {!asking && error && <span role="alert" className="error">{error}</span>}
      {asking ? (
        <button type="submit" className="btn btn-primary" disabled={busy || !pin}>{busy ? "Abriendo…" : "Revelar"}</button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setAsking(true)}>Revelar</button>
      )}
    </form>
  );
}

export default function Sorteo() {
  const { me, error } = useMe();
  return (
    <main className="screen" style={{ gap: 18 }}>
      <Clouds />
      <Link href="/grupo" className="back" aria-label="Volver al grupo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      {me ? <Reveal me={me} /> : error ? <span role="alert" className="error">{error}</span> : <p className="lede">Cargando…</p>}
    </main>
  );
}
