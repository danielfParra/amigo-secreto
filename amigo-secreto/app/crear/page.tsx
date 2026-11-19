"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Clouds from "@/components/Clouds";
import Field from "@/components/Field";
import PinFields, { type PinErrors, type PinValues } from "@/components/PinFields";
import { apiFetch } from "@/lib/client/api";
import { saveDeviceWrapKey } from "@/lib/client/deviceKey";
import { createCredentialsWithKey } from "@/lib/client/session";
import { MIN_PIN_LENGTH } from "@/lib/crypto/kdf";
import { parseRoster, sortNames } from "@/lib/names";
import { parseCop } from "@/lib/cop";

type Errors = PinErrors & Partial<Record<"groupName" | "priceCap" | "names" | "me" | "eventDate", string>>;

export default function Crear() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [priceCap, setPriceCap] = useState("$60.000");
  const [rosterText, setRosterText] = useState("");
  const [me, setMe] = useState("");
  const [pins, setPins] = useState<PinValues>({ pin: "", pin2: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The app serves one family group: if it already exists, there is nothing to create.
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ group: unknown }>("/api/roster").then((r) => {
      if (!cancelled && r.ok && r.data.group) router.replace("/entrar");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const roster = useMemo(() => parseRoster(rosterText), [rosterText]);
  const sorted = useMemo(() => sortNames(roster.names), [roster.names]);
  const myName = sorted.includes(me) ? me : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Errors = {};
    const cap = parseCop(priceCap);
    if (!groupName.trim()) next.groupName = "Ponle un nombre al grupo";
    if (cap === null || cap < 1000) next.priceCap = "Escribe un tope válido, por ejemplo $60.000";
    if (roster.names.length < 2) next.names = "Escribe al menos dos nombres";
    else if (roster.names.length > 50) next.names = "Máximo 50 personas";
    else if (roster.duplicates.length) next.names = `Hay nombres repetidos: ${roster.duplicates.join(", ")}`;
    else if (roster.tooLong.length) next.names = "Algún nombre es demasiado largo";
    if (!myName) next.me = "Elige cuál de los nombres eres tú";
    if (pins.pin.length < MIN_PIN_LENGTH) next.pin = `Mínimo ${MIN_PIN_LENGTH} caracteres`;
    else if (pins.pin !== pins.pin2) next.pin2 = "Los dos PIN no coinciden";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const { credentials, wrapKey } = await createCredentialsWithKey(pins.pin);
      const r = await apiFetch("/api/groups", "POST", {
        groupName: groupName.trim(),
        eventDate: eventDate || undefined,
        priceCap: cap,
        names: roster.names,
        me: myName,
        ...credentials,
      });
      if (r.ok) {
        const who = await apiFetch<{ user: { id: string } }>("/api/me");
        if (who.ok) await saveDeviceWrapKey(who.data.user.id, wrapKey);
        router.push("/grupo");
        return;
      }
      if (r.status === 409) router.replace("/entrar");
      else if (r.field && ["groupName", "priceCap", "names", "me", "eventDate"].includes(r.field)) setErrors({ [r.field]: r.error });
      else setFormError(r.error);
    } catch {
      setFormError("No pudimos crear tu llave en este navegador. Prueba con otro.");
    }
    setBusy(false);
  }

  return (
    <main className="screen">
      <Clouds />
      <form onSubmit={submit} noValidate style={{ display: "contents" }}>
        <div className="stack">
          <h1>Crea tu grupo</h1>
          <p className="lede">Tú organizas el sorteo, pero nunca verás quién le regala a quién.</p>
        </div>

        <div className="stack">
          <Field id="grupo" label="Nombre del grupo" type="text" placeholder="Navidad en familia 2026" maxLength={80}
            value={groupName} onChange={(e) => setGroupName(e.target.value)} error={errors.groupName} />
          <Field id="fecha" label="Fecha del intercambio (opcional)" type="date"
            value={eventDate} onChange={(e) => setEventDate(e.target.value)} error={errors.eventDate} />
          <Field id="tope" label="Tope por regalo" type="text" inputMode="numeric"
            value={priceCap} onChange={(e) => setPriceCap(e.target.value)} error={errors.priceCap} />
        </div>

        <div className="field">
          <label htmlFor="lista">¿Quiénes participan?</label>
          <textarea id="lista" className="input" rows={6} style={{ padding: 14, minHeight: 140, resize: "vertical" }}
            placeholder={"Un nombre por línea, o separados por comas.\nEj: Ana Ruiz, Bea Soto, Carlos Díaz"}
            value={rosterText} onChange={(e) => setRosterText(e.target.value)}
            aria-invalid={errors.names ? true : undefined} aria-describedby="lista-ayuda" />
          <span id="lista-ayuda" style={{ fontSize: 13, color: "var(--muted)" }}>
            {roster.names.length ? `${roster.names.length} personas, en orden alfabético.` : "Cada persona elegirá su nombre al unirse. No hace falta el correo."}
          </span>
          {errors.names && <span role="alert" className="error">{errors.names}</span>}
        </div>

        {sorted.length > 0 && (
          <div className="field">
            <label htmlFor="yo">¿Cuál eres tú?</label>
            <select id="yo" className="input" value={myName} onChange={(e) => setMe(e.target.value)} aria-invalid={errors.me ? true : undefined}>
              <option value="">Elige tu nombre</option>
              {sorted.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {errors.me && <span role="alert" className="error">{errors.me}</span>}
          </div>
        )}

        <div className="stack">
          <PinFields values={pins} errors={errors} onChange={(p) => setPins((v) => ({ ...v, ...p }))} />
        </div>

        {formError && <span role="alert" className="error">{formError}</span>}

        <div className="push stack" style={{ alignItems: "center", gap: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creando tu llave secreta…" : "Crear grupo"}
          </button>
          <Button variant="link" href="/entrar">Ya hay un grupo: entrar</Button>
        </div>
      </form>
    </main>
  );
}
