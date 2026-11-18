"use client";

import Clouds from "@/components/Clouds";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Bubble from "@/components/Bubble";
import Button from "@/components/Button";
import MemberRow from "@/components/MemberRow";
import { useUnread } from "@/lib/client/useUnread";
import { clearChatKeys } from "@/lib/client/chat";
import ProgressBar from "@/components/ProgressBar";
import { apiFetch, type ApiResult } from "@/lib/client/api";
import { useMe, type Me } from "@/lib/client/useMe";
import { formatCop } from "@/lib/cop";
import { formatEventDate } from "@/lib/dates";
import { buildDrawWithChat, DRAW_RESTRICTIONS, type DrawMember } from "@/lib/draw";

type Status = {
  members: { id: string; name: string; claimed: boolean; ready: boolean; resetPending: boolean }[];
  size: number;
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
  const [addInput, setAddInput] = useState<string | null>(null);

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
      try {
        const { results, inbox, threads } = await buildDrawWithChat(inputs.data, undefined, DRAW_RESTRICTIONS);
        return apiFetch("/api/draw", "POST", { results, inbox, threads });
      } catch (e) {
        return { ok: false as const, status: 0, error: e instanceof Error ? e.message : "No se pudo hacer el sorteo" };
      }
    }, "¡Sorteo hecho! Cada quien ya puede ver a quién le regala.");
  }

  async function addPerson() {
    const name = (addInput ?? "").trim();
    if (!name) return;
    await run(() => apiFetch("/api/members", "POST", { name }), `${name} se agregó a la lista. Si el sorteo ya estaba hecho, hay que repetirlo.`);
    setAddInput(null);
  }

  async function logout() {
    clearChatKeys();
    await apiFetch("/api/logout", "POST", {});
    router.replace("/");
  }

  const unread = useUnread(me.user.id, Boolean(status?.drawDone));
  const total = status?.size ?? 0;
  const waiting = status?.members.filter((m) => m.resetPending).map((m) => m.name) ?? [];
  const notJoined = status?.members.filter((m) => !m.claimed).map((m) => m.name) ?? [];

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

      {myRow?.ready && !status?.drawDone && (
        <Link href="/lista" className="btn btn-primary" style={{ alignSelf: "flex-start", width: "auto", textDecoration: "none" }}>Editar mi lista</Link>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
          <span style={{ fontWeight: 700 }}>Listas completas</span>
          <span style={{ fontWeight: 800 }}>{status ? `${status.readyCount} de ${total}` : "…"}</span>
        </div>
        <ProgressBar value={status?.readyCount ?? 0} max={total} label="Listas completas" />
        {notJoined.length > 0 && (
          <span style={{ fontSize: 14, color: "var(--muted)" }}>Faltan por unirse: {notJoined.length}</span>
        )}
      </div>

      <ul className="card people" aria-label="Personas del grupo">
        {status?.members.map((m, i) => (
          <MemberRow key={m.id} name={m.name} claimed={m.claimed} ready={m.ready} resetPending={m.resetPending} index={i} isSelf={m.id === me.user.id}
            canManage={isOrganizer && m.id !== me.user.id} busy={busy}
            onAction={(a) =>
              run(
                () => apiFetch(a === "pin" ? `/api/members/${m.id}/reset-pin` : `/api/members/${m.id}`, a === "pin" ? "POST" : "DELETE", a === "pin" ? {} : undefined),
                a === "pin" ? `Listo: ${m.name} elegirá un PIN nuevo la próxima vez que entre.` : `${m.name} salió del grupo.`,
              )
            } />
        )) ?? <li style={{ listStyle: "none", padding: 12 }} className="lede">Cargando…</li>}
      </ul>

      {isOrganizer && (
        <div className="stack" style={{ gap: 8 }}>
          {addInput === null ? (
            <button type="button" className="btn btn-link" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setAddInput("")}>
              + Agregar a alguien a la lista
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label htmlFor="nuevo" className="sr-only">Nombre de la persona</label>
              <input id="nuevo" className="input" type="text" maxLength={60} placeholder="Nombre y apellido" autoFocus style={{ minHeight: 48 }}
                value={addInput} onChange={(e) => setAddInput(e.target.value)} />
              <button type="button" className="btn btn-ghost" style={{ width: "auto", padding: "0 16px" }} disabled={busy || !addInput.trim()} onClick={addPerson}>Agregar</button>
              <button type="button" className="btn btn-link" onClick={() => setAddInput(null)}>Cancelar</button>
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
            <Link href="/chat" className="btn btn-ghost" style={{ position: "relative" }}>
              Chat anónimo
              {(unread.to || unread.from) && <span className="dot" aria-label="Mensaje nuevo" style={{ top: 12, right: 18 }} />}
            </Link>
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
                  : notJoined.length
                    ? `Esperando a que se unan: ${notJoined.join(", ")}`
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
      <Clouds />
      {me ? <GrupoView me={me} reloadMe={reload} /> : error ? <span role="alert" className="error">{error}</span> : <p className="lede">Cargando…</p>}
    </main>
  );
}
