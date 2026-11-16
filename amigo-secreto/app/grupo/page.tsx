"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Bubble from "@/components/Bubble";
import Button from "@/components/Button";
import MemberRow from "@/components/MemberRow";
import ProgressBar from "@/components/ProgressBar";
import { apiFetch, type ApiResult } from "@/lib/client/api";
import { useMe, type Me } from "@/lib/client/useMe";
import { formatCop } from "@/lib/cop";
import { formatEventDate } from "@/lib/dates";
import { buildDraw, type DrawMember } from "@/lib/draw";

type Status = {
  members: { id: string; name: string; ready: boolean; resetPending: boolean }[];
  expectedSize: number;
  readyCount: number;
  drawDone: boolean;
  canDraw: boolean;
};

function GrupoView({ me, reloadMe }: { me: Me; reloadMe: () => Promise<void> }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [sizeInput, setSizeInput] = useState<string | null>(null);

  const apply = useCallback((r: ApiResult<Status>) => {
    if (r.ok) setStatus(r.data);
    else setError(r.error);
  }, []);
  const refresh = useCallback(async () => apply(await apiFetch<Status>("/api/group")), [apply]);

  useEffect(() => {
    let cancelled = false;
    const tick = () =>
      apiFetch<Status>("/api/group").then((r) => {
        if (!cancelled) apply(r);
      });
    tick();
    const id = setInterval(tick, 15000); // keep "N de M" fresh while people join and finish lists
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [apply]);

  const isOrganizer = me.user.isOrganizer;
  const myRow = status?.members.find((m) => m.id === me.user.id);
  const date = formatEventDate(me.group.eventDate);

  async function run<T>(work: () => Promise<ApiResult<T>>, success?: string) {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await work();
    if (!r.ok) setError(r.error);
    else if (success) setNote(success);
    await Promise.all([refresh(), reloadMe()]);
    setBusy(false);
  }

  async function invite() {
    const url = `${location.origin}/unirse?c=${me.group.inviteCode}`;
    const text = `Te invito al amigo secreto "${me.group.name}". Únete aquí: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Amigo secreto", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Enlace de invitación copiado");
    } catch {
      setNote(`Comparte este código: ${me.group.inviteCode}`);
    }
  }

  async function makeDraw() {
    await run(async () => {
      const inputs = await apiFetch<DrawMember[]>("/api/draw/inputs");
      if (!inputs.ok) return inputs;
      // The pairing is made and encrypted here, in this browser; the server only stores the sealed results.
      const results = await buildDraw(inputs.data);
      return apiFetch("/api/draw", "POST", { results });
    }, "¡Sorteo hecho! Cada quien ya puede ver a quién le regala.");
  }

  async function saveSize() {
    const n = Number(sizeInput);
    await run(() => apiFetch("/api/groups", "PATCH", { expectedSize: n }), "Listo, cambiamos el número de personas.");
    setSizeInput(null);
  }

  async function logout() {
    await apiFetch("/api/logout", "POST", {});
    router.replace("/");
  }

  const total = status?.expectedSize ?? me.group.expectedSize;
  const waiting = status?.members.filter((m) => m.resetPending).map((m) => m.name) ?? [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" className="btn btn-link" onClick={logout}>Cerrar sesión</button>
        {isOrganizer && !status?.drawDone && (
          <button type="button" className="btn btn-ghost" style={{ width: "auto", minHeight: 44, padding: "0 16px", fontSize: 15 }} onClick={invite}>
            Invitar
          </button>
        )}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <h1>{me.group.name}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {date && <span className="chip tone-green">{date}</span>}
          <span className="chip tone-brown">Hasta {formatCop(me.group.priceCap)}</span>
        </div>
      </div>

      {myRow && !myRow.ready && !status?.drawDone && (
        <Bubble tone="brown" style={{ maxWidth: "none" }}>
          Aún falta tu lista. <Link href="/lista" style={{ textDecoration: "underline" }}>Escribe tus tres deseos</Link>
        </Bubble>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
          <span style={{ fontWeight: 700 }}>Listas completas</span>
          <span style={{ fontWeight: 800 }}>{status ? `${status.readyCount} de ${total}` : "…"}</span>
        </div>
        <ProgressBar value={status?.readyCount ?? 0} max={total} label="Listas completas" />
        {status && status.members.length < total && (
          <span style={{ fontSize: 14, color: "var(--muted)" }}>Faltan {total - status.members.length} por unirse</span>
        )}
      </div>

      <ul className="card" style={{ padding: "6px 16px" }} aria-label="Personas del grupo">
        {status?.members.map((m, i) => (
          <MemberRow key={m.id} name={m.name} ready={m.ready} resetPending={m.resetPending} index={i} isSelf={m.id === me.user.id}
            canManage={isOrganizer && m.id !== me.user.id} busy={busy}
            onAction={(a) =>
              run(
                () => apiFetch(a === "pin" ? `/api/members/${m.id}/reset-pin` : `/api/members/${m.id}`, a === "pin" ? "POST" : "DELETE", a === "pin" ? {} : undefined),
                a === "pin" ? `Listo: ${m.name} elegirá un PIN nuevo la próxima vez que entre.` : `${m.name} salió del grupo.`,
              )
            } />
        )) ?? <li style={{ listStyle: "none", padding: 12 }} className="lede">Cargando…</li>}
      </ul>

      {isOrganizer && !status?.drawDone && (
        <div className="stack" style={{ gap: 8 }}>
          {sizeInput === null ? (
            <button type="button" className="btn btn-link" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setSizeInput(String(total))}>
              Somos {total} personas · Cambiar
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label htmlFor="size" className="sr-only">Número de personas</label>
              <input id="size" className="input" type="number" inputMode="numeric" min={2} max={50} style={{ width: 100, minHeight: 48 }}
                value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} />
              <button type="button" className="btn btn-ghost" style={{ width: "auto", padding: "0 16px" }} disabled={busy} onClick={saveSize}>Guardar</button>
              <button type="button" className="btn btn-link" onClick={() => setSizeInput(null)}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {note && <Bubble tone="green" style={{ maxWidth: "none" }}>{note}</Bubble>}
      {error && <span role="alert" className="error">{error}</span>}

      <div className="push stack" style={{ gap: 8 }}>
        {status?.drawDone ? (
          <>
            <Button href="/privacidad">Ver mi amigo secreto</Button>
            {isOrganizer &&
              (confirmRedo ? (
                <div className="stack" style={{ gap: 8 }}>
                  <span style={{ fontSize: 14, color: "var(--muted)", textAlign: "center" }}>Se borra el sorteo y habrá que hacerlo de nuevo.</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-ghost" disabled={busy}
                      onClick={() => { setConfirmRedo(false); void run(() => apiFetch("/api/draw", "DELETE"), "Sorteo reabierto."); }}>
                      Sí, rehacer
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmRedo(false)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmRedo(true)}>Rehacer sorteo</button>
              ))}
          </>
        ) : isOrganizer ? (
          <>
            <button type="button" className="btn btn-primary" disabled={!status?.canDraw || busy} onClick={makeDraw}>
              {busy ? "Sorteando…" : "Hacer el sorteo"}
            </button>
            <span style={{ fontSize: 14, color: "var(--muted)", textAlign: "center" }}>
              {status?.canDraw
                ? "Todo listo. El sorteo se hace en tu celular y nadie verá los resultados."
                : waiting.length
                  ? `Esperando a que ${waiting.join(", ")} elija su PIN nuevo`
                  : `Se activa cuando las ${total} listas estén completas`}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 14, color: "var(--muted)", textAlign: "center" }}>Quien organiza hará el sorteo cuando todas las listas estén completas.</span>
        )}
      </div>
    </>
  );
}

export default function Grupo() {
  const { me, error, reload } = useMe();
  return (
    <main className="screen" style={{ gap: 20 }}>
      {me ? <GrupoView me={me} reloadMe={reload} /> : error ? <span role="alert" className="error">{error}</span> : <p className="lede">Cargando…</p>}
    </main>
  );
}
