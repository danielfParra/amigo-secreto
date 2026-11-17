"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Clouds from "@/components/Clouds";
import Field from "@/components/Field";
import { clearChatKeys, fetchLines, loadChatKeys, saveChatKeys, sendLine, setSeen, unlockChat, type ChatKeys, type ChatLine } from "@/lib/client/chat";
import { useMe, type Me } from "@/lib/client/useMe";
import { useUnread } from "@/lib/client/useUnread";
import { MESSAGE_MAX_CHARS, type Role, type Thread } from "@/lib/crypto/chat";

function Pane({ thread, role, hint, visible, onGone }: { thread: Thread; role: Role; hint: string; visible: boolean; onGone: () => void }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const end = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetchLines(thread, last.current);
    if (!r.ok) {
      if (r.gone) onGone(); // the draw was redone: these keys are dead, ask for the PIN again
      else setError(r.error);
      return;
    }
    if (r.lines.length) {
      last.current = r.lines[r.lines.length - 1].id;
      setLines((prev) => [...prev, ...r.lines]);
    }
  }, [thread, onGone]);

  useEffect(() => {
    if (!visible) return; // the other tab is covered by the unread check
    void refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [refresh, visible]);

  // What is on screen counts as read, so the dot clears when the tab is open.
  useEffect(() => {
    if (visible && last.current) setSeen(thread.id, last.current);
    end.current?.scrollIntoView({ block: "end" });
  }, [lines, visible, thread.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await sendLine(thread, role, text);
    if (r.ok) {
      setText("");
      await refresh();
    } else setError(r.error);
    setBusy(false);
  }

  return (
    <div className="pane" hidden={!visible}>
      <div className="chat-list" role="log" aria-live="polite" aria-label="Mensajes">
        {lines.length === 0 && <p className="lede" style={{ textAlign: "center", margin: "auto" }}>{hint}</p>}
        {lines.map((l) => (
          <div key={l.id} className={`msg ${l.role === role ? "mine" : "theirs"}`}>
            {l.text}
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && <span role="alert" className="error">{error}</span>}
      <form onSubmit={send} className="composer" noValidate>
        <label htmlFor={`m-${thread.id}`} className="sr-only">Escribe un mensaje</label>
        <input id={`m-${thread.id}`} className="input" type="text" maxLength={MESSAGE_MAX_CHARS} placeholder="Escribe un mensaje…"
          autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>Enviar</button>
      </form>
    </div>
  );
}

function Unlock({ me, onOpen }: { me: Me; onOpen: (k: ChatKeys) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onOpen(await unlockChat(me, pin));
    } catch (err) {
      setError(err instanceof Error && err.message.includes("sorteo") ? err.message : "Ese PIN no es el tuyo. Intenta de nuevo.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="stack" style={{ flex: 1 }}>
      <h1>Chat anónimo</h1>
      <p className="lede">Escribe tu PIN para abrir tus chats. Solo tú y la otra persona pueden leerlos.</p>
      <Field id="pin" label="Tu PIN" type="password" autoComplete="current-password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} error={error} />
      <button type="submit" className="btn btn-primary push" disabled={busy || !pin}>{busy ? "Abriendo…" : "Abrir chats"}</button>
    </form>
  );
}

function Chats({ keys, userId, onGone }: { keys: ChatKeys; userId: string; onGone: () => void }) {
  const [tab, setTab] = useState<"to" | "from">("to");
  const unread = useUnread(userId);
  return (
    <>
      <h1>Chat anónimo</h1>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "to"} className={tab === "to" ? "tab on" : "tab"} onClick={() => setTab("to")}>
          Mi amigo secreto{unread.to && tab !== "to" && <span className="dot" aria-label="Mensaje nuevo" />}
        </button>
        <button type="button" role="tab" aria-selected={tab === "from"} className={tab === "from" ? "tab on" : "tab"} onClick={() => setTab("from")}>
          Quien me regala{unread.from && tab !== "from" && <span className="dot" aria-label="Mensaje nuevo" />}
        </button>
      </div>
      <p className="lede" style={{ fontSize: 15 }}>
        {tab === "to"
          ? `Le escribes a ${keys.receiverName}, pero no sabrá que eres tú.`
          : "Tu amigo secreto te escribe aquí. No sabes quién es."}
      </p>
      <Pane thread={keys.toThread} role="g" hint="Aún no hay mensajes. Pregunta por sus gustos o pide ayuda con el regalo." visible={tab === "to"} onGone={onGone} />
      <Pane thread={keys.fromThread} role="r" hint="Aún no te han escrito. Puedes responder cuando lo hagan." visible={tab === "from"} onGone={onGone} />
    </>
  );
}

export default function Chat() {
  const { me, error } = useMe();
  const [keys, setKeys] = useState<ChatKeys | null>(null);
  useEffect(() => {
    if (me) setKeys(loadChatKeys(me.user.id)); // eslint-disable-line react-hooks/set-state-in-effect -- sessionStorage only exists in the browser
  }, [me]);

  return (
    <main className="screen" style={{ gap: 14 }}>
      <Clouds />
      <Link href="/grupo" className="back" aria-label="Volver al grupo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      {!me ? (
        error ? <span role="alert" className="error">{error}</span> : <p className="lede">Cargando…</p>
      ) : !me.group.drawDone ? (
        <div className="stack">
          <h1>Aún no hay chat</h1>
          <p className="lede">El chat se abre cuando quien organiza hace el sorteo.</p>
        </div>
      ) : keys ? (
        <Chats keys={keys} userId={me.user.id} onGone={() => { clearChatKeys(); setKeys(null); }} />
      ) : (
        <Unlock me={me} onOpen={(k) => { saveChatKeys(me.user.id, k); setKeys(k); }} />
      )}
    </main>
  );
}
