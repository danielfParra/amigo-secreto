"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Bubble from "./Bubble";
import Button from "./Button";
import Clouds from "./Clouds";
import Field from "./Field";
import PinFields, { type PinErrors, type PinValues } from "./PinFields";
import { apiFetch } from "@/lib/client/api";
import { saveDeviceWrapKey } from "@/lib/client/deviceKey";
import { createCredentialsWithKey } from "@/lib/client/session";
import { MIN_PIN_LENGTH } from "@/lib/crypto/kdf";
import { formatCop } from "@/lib/cop";

type GroupInfo = { name: string; eventDate: string | null; priceCap: number; members: { id: string; name: string; claimed: boolean }[] };

export default function JoinForm() {
  const router = useRouter();
  const codeFromUrl = (useSearchParams().get("c") ?? "").toUpperCase();
  const [code, setCode] = useState(codeFromUrl);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [memberId, setMemberId] = useState("");
  const [pins, setPins] = useState<PinValues>({ pin: "", pin2: "" });
  const [errors, setErrors] = useState<PinErrors & { member?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (code.length < 8) return;
    let cancelled = false;
    apiFetch<GroupInfo>(`/api/groups/${encodeURIComponent(code)}`).then((r) => {
      if (cancelled) return;
      setGroup(r.ok ? r.data : null);
      setFormError(r.ok ? null : r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [code, reload]);
  // The group only counts while the code is complete; derived so no state reset is needed.
  const activeGroup = code.length >= 8 ? group : null;
  const open = activeGroup?.members.filter((m) => !m.claimed) ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: PinErrors & { member?: string } = {};
    if (!memberId) next.member = "Elige tu nombre en la lista";
    if (pins.pin.length < MIN_PIN_LENGTH) next.pin = `Mínimo ${MIN_PIN_LENGTH} caracteres`;
    else if (pins.pin !== pins.pin2) next.pin2 = "Los dos PIN no coinciden";
    setErrors(next);
    if (Object.keys(next).length || !activeGroup) {
      if (!activeGroup) setFormError("Escribe el código del grupo para unirte");
      return;
    }
    setBusy(true);
    try {
      const { credentials, wrapKey } = await createCredentialsWithKey(pins.pin);
      const r = await apiFetch("/api/join", "POST", { inviteCode: code, memberId, ...credentials });
      if (r.ok) {
        await saveDeviceWrapKey(memberId, wrapKey);
        router.push("/lista");
        return;
      }
      setFormError(r.error);
      if (r.status === 409) {
        setMemberId("");
        setReload((n) => n + 1); // someone took the name meanwhile: refresh the list
      }
    } catch {
      setFormError("No pudimos crear tu llave en este navegador. Prueba con otro.");
    }
    setBusy(false);
  }

  return (
    <main className="screen" style={{ paddingTop: "calc(44px + env(safe-area-inset-top))" }}>
      <Clouds />
      <form onSubmit={submit} noValidate style={{ display: "contents" }}>
        <div className="stack">
          {activeGroup && <span className="chip tone-brown" style={{ alignSelf: "flex-start" }}>{activeGroup.name}</span>}
          <h1 style={{ fontSize: 38 }}>Te invitaron al amigo secreto</h1>
          <p className="lede">
            {activeGroup
              ? `Pide tres regalos de hasta ${formatCop(activeGroup.priceCap)} y espera el sorteo.`
              : "Pide tres regalos y espera el sorteo."}
          </p>
        </div>

        {!codeFromUrl && (
          <Field id="codigo" label="Código del grupo" type="text" autoCapitalize="characters" autoComplete="off"
            placeholder="Ej: K7M2QX9A" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        )}

        {activeGroup && (
          <fieldset className="stack" style={{ border: "none", gap: 8 }} aria-describedby={errors.member ? "member-error" : undefined}>
            <legend style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>¿Quién eres?</legend>
            {open.length === 0 && (
              <Bubble tone="green" style={{ maxWidth: "none" }}>Todos los nombres ya se unieron. Si eres tú, entra con tu PIN.</Bubble>
            )}
            {activeGroup.members.map((m) => (
              <label key={m.id} className="pick" data-taken={m.claimed || undefined}>
                <input type="radio" name="member" value={m.id} disabled={m.claimed} checked={memberId === m.id}
                  onChange={() => setMemberId(m.id)} />
                <span>{m.name}</span>
                {m.claimed && <small>Ya se unió</small>}
              </label>
            ))}
            {errors.member && <span id="member-error" role="alert" className="error">{errors.member}</span>}
          </fieldset>
        )}

        {activeGroup && open.length > 0 && (
          <div className="stack">
            <PinFields values={pins} errors={errors} onChange={(p) => setPins((v) => ({ ...v, ...p }))} />
          </div>
        )}

        {activeGroup && open.length > 0 && (
          <Bubble tone="green" style={{ alignSelf: "flex-end" }}>Solo tú sabrás a quién le regalas</Bubble>
        )}

        {formError && <span role="alert" className="error">{formError}</span>}

        <div className="push stack" style={{ alignItems: "center", gap: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={busy || !activeGroup || open.length === 0}>
            {busy ? "Creando tu llave secreta…" : "Unirme"}
          </button>
          <Button variant="link" href="/entrar">Ya me uní: entrar con mi PIN</Button>
        </div>
      </form>
    </main>
  );
}
