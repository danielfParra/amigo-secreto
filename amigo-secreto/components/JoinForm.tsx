"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AccountFields, { type AccountValues, type FieldErrors } from "./AccountFields";
import Bubble from "./Bubble";
import Button from "./Button";
import Clouds from "./Clouds";
import Field from "./Field";
import { apiFetch } from "@/lib/client/api";
import { registerAccount } from "@/lib/client/session";
import { MIN_PIN_LENGTH } from "@/lib/crypto/kdf";
import { formatCop } from "@/lib/cop";

type GroupInfo = { name: string; eventDate: string | null; priceCap: number };

export default function JoinForm() {
  const router = useRouter();
  const codeFromUrl = (useSearchParams().get("c") ?? "").toUpperCase();
  const [code, setCode] = useState(codeFromUrl);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [values, setValues] = useState<AccountValues>({ name: "", email: "", pin: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  }, [code]);
  // The group info only counts while the code is complete; derived so no state reset is needed.
  const activeGroup = code.length >= 8 ? group : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!values.name.trim()) next.name = "Escribe tu nombre";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Escribe un correo válido";
    if (values.pin.length < MIN_PIN_LENGTH) next.pin = `Mínimo ${MIN_PIN_LENGTH} caracteres`;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length || !activeGroup) {
      if (!activeGroup) setFormError("Escribe el código del grupo para unirte");
      return;
    }
    setBusy(true);
    try {
      const account = await registerAccount(values);
      const r = await apiFetch("/api/join", "POST", { inviteCode: code, ...account });
      if (r.ok) {
        router.push("/lista");
        return;
      }
      if (r.field === "email") setErrors({ email: r.error });
      else setFormError(r.error);
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

        <div className="stack">
          {!codeFromUrl && (
            <Field
              id="codigo"
              label="Código del grupo"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="Ej: K7M2QX9A"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          )}
          <AccountFields values={values} errors={errors} onChange={(p) => setValues((v) => ({ ...v, ...p }))} />
        </div>

        <Bubble tone="green" style={{ alignSelf: "flex-end" }}>
          Solo tú sabrás a quién le regalas
        </Bubble>

        {formError && (
          <span role="alert" className="error">
            {formError}
          </span>
        )}

        <div className="push stack" style={{ alignItems: "center", gap: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creando tu llave secreta…" : "Unirme"}
          </button>
          <Button variant="link" href="/crear">
            Crear un grupo nuevo
          </Button>
          <Button variant="link" href="/entrar">
            Ya tengo cuenta
          </Button>
        </div>
      </form>
    </main>
  );
}
