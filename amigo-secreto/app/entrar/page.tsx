"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Bubble from "@/components/Bubble";
import Button from "@/components/Button";
import Clouds from "@/components/Clouds";
import Field from "@/components/Field";
import { apiFetch } from "@/lib/client/api";
import { createCredentials, loginSecrets } from "@/lib/client/session";
import { MIN_PIN_LENGTH } from "@/lib/crypto/kdf";

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    const mail = email.trim().toLowerCase();
    if (!mail || !pin) {
      setError("Escribe tu correo y tu PIN");
      return;
    }
    const salt = await apiFetch<{ salt: string; reset: boolean }>(`/api/salt?email=${encodeURIComponent(mail)}`);
    if (!salt.ok) {
      setError(salt.error);
      return;
    }
    if (salt.data.reset) {
      setResetMode(true); // the organizer reset this PIN: let them pick a new one instead
      return;
    }
    const { authSecret } = await loginSecrets(pin, salt.data.salt);
    const r = await apiFetch("/api/login", "POST", { email: mail, authSecret });
    if (r.ok) {
      router.push("/grupo");
      return;
    }
    if (r.status === 403) setResetMode(true);
    else setError(r.error);
  }

  async function chooseNewPin() {
    if (newPin.length < MIN_PIN_LENGTH) {
      setError(`El PIN debe tener mínimo ${MIN_PIN_LENGTH} caracteres`);
      return;
    }
    if (newPin !== confirmPin) {
      setError("Los dos PIN no coinciden");
      return;
    }
    const creds = await createCredentials({ pin: newPin, email });
    const r = await apiFetch("/api/pin-reset", "POST", creds);
    if (r.ok) {
      router.push("/grupo");
      return;
    }
    setError(r.error);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (resetMode) await chooseNewPin();
      else await signIn();
    } catch {
      setError("No pudimos abrir tu cuenta en este navegador. Prueba con otro.");
    }
    setBusy(false);
  }

  return (
    <main className="screen" style={{ paddingTop: "calc(44px + env(safe-area-inset-top))" }}>
      <Clouds />
      <form onSubmit={submit} noValidate style={{ display: "contents" }}>
        <div className="stack">
          <h1>{resetMode ? "Elige un PIN nuevo" : "Qué bueno verte de nuevo"}</h1>
          <p className="lede">
            {resetMode
              ? "Tu organizador restableció tu PIN. Elige uno nuevo para entrar."
              : "Entra con el correo y el PIN con los que te uniste."}
          </p>
        </div>

        <div className="stack">
          <Field id="correo" label="Correo electrónico" type="email" autoComplete="email" inputMode="email"
            placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)}
            readOnly={resetMode} />
          {resetMode ? (
            <>
              <Field id="pin-nuevo" label="PIN nuevo" type="password" autoComplete="new-password"
                placeholder="Mínimo 4 caracteres" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
              <Field id="pin-confirmar" label="Repite el PIN nuevo" type="password" autoComplete="new-password"
                value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
            </>
          ) : (
            <Field id="pin" label="PIN o contraseña" type="password" autoComplete="current-password"
              value={pin} onChange={(e) => setPin(e.target.value)} />
          )}
        </div>

        {resetMode && (
          <Bubble tone="brown">Tus deseos siguen guardados. Si el sorteo ya estaba hecho, quien organiza lo repetirá.</Bubble>
        )}

        {error && (
          <span role="alert" className="error">
            {error}
          </span>
        )}

        <div className="push stack" style={{ alignItems: "center", gap: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? (resetMode ? "Creando tu llave nueva…" : "Entrando…") : resetMode ? "Guardar PIN nuevo y entrar" : "Entrar"}
          </button>
          <Button variant="link" href="/unirse">
            Unirme a un grupo
          </Button>
        </div>
      </form>
    </main>
  );
}
