"use client";

import Clouds from "@/components/Clouds";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WishCard, { type WishDraft, type WishErrors } from "@/components/WishCard";
import { apiFetch } from "@/lib/client/api";
import { useMe, type Me } from "@/lib/client/useMe";
import { formatCop, parseCop } from "@/lib/cop";

const EMPTY: WishDraft = { title: "", price: "", link: "", details: "" };

function ListaForm({ me }: { me: Me }) {
  const router = useRouter();
  const cap = me.group.priceCap;
  const locked = me.group.drawDone;
  const [wishes, setWishes] = useState<WishDraft[]>(() =>
    [0, 1, 2].map((i) => {
      const w = me.wishes[i];
      return w ? { title: w.title, price: formatCop(w.price), link: w.link ?? "", details: w.details ?? "" } : EMPTY;
    }),
  );
  const [serverErrors, setServerErrors] = useState<WishErrors[]>([{}, {}, {}]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Over-cap is shown live, as in the sketch; other problems appear when saving.
  const liveErrors = wishes.map((w): WishErrors => {
    const p = parseCop(w.price);
    return p !== null && p > cap ? { price: `Uy, se pasa del tope de ${formatCop(cap)}` } : {};
  });
  const errorsFor = (i: number): WishErrors => ({ ...serverErrors[i], ...liveErrors[i] });

  function patch(i: number, p: Partial<WishDraft>) {
    setWishes((ws) => ws.map((w, j) => (j === i ? { ...w, ...p } : w)));
    setServerErrors((es) => es.map((e, j) => (j === i ? {} : e)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const local: WishErrors[] = wishes.map((w) => {
      const err: WishErrors = {};
      if (!w.title.trim()) err.title = "Escribe qué regalo quieres";
      const p = parseCop(w.price);
      if (p === null) err.price = "Escribe un precio válido, por ejemplo $48.000";
      return err;
    });
    if (local.some((x) => Object.keys(x).length)) {
      setServerErrors(local);
      return;
    }
    if (liveErrors.some((x) => x.price)) return;
    setBusy(true);
    const r = await apiFetch("/api/wishes", "PUT", {
      wishes: wishes.map((w) => ({ title: w.title, price: w.price, link: w.link, details: w.details })),
    });
    if (r.ok) {
      router.push("/grupo");
      return;
    }
    const m = r.field?.match(/^wishes\.(\d)\.(title|price|link|details)$/);
    if (m) setServerErrors((es) => es.map((x, j) => (j === Number(m[1]) ? { [m[2]]: r.error } : x)));
    else setFormError(r.error);
    setBusy(false);
  }

  return (
    <form onSubmit={save} noValidate style={{ display: "contents" }}>
      <div className="stack" style={{ gap: 10 }}>
        <h1>Tus tres deseos</h1>
        <span className="chip tone-brown" style={{ alignSelf: "flex-start" }}>Máximo {formatCop(cap)} COP cada uno</span>
        {locked && <span className="chip tone-green" style={{ alignSelf: "flex-start" }}>El sorteo ya se hizo: tu lista quedó fija</span>}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {wishes.map((w, i) => (
          <WishCard key={i} index={i} value={w} errors={errorsFor(i)} disabled={locked} onChange={(p) => patch(i, p)} />
        ))}
      </div>

      {formError && <span role="alert" className="error">{formError}</span>}

      <button type="submit" className="btn btn-primary push" disabled={busy || locked}>
        {busy ? "Guardando…" : "Guardar mi lista"}
      </button>
    </form>
  );
}

export default function Lista() {
  const { me, error } = useMe();
  return (
    <main className="screen" style={{ gap: 18 }}>
      <Clouds />
      <Link href="/grupo" className="back" aria-label="Volver al grupo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      {me ? <ListaForm me={me} /> : error ? <span role="alert" className="error">{error}</span> : <p className="lede">Cargando…</p>}
    </main>
  );
}
