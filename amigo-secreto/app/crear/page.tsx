"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountFields, { type AccountValues, type FieldErrors } from "@/components/AccountFields";
import Button from "@/components/Button";
import Clouds from "@/components/Clouds";
import Field from "@/components/Field";
import { apiFetch } from "@/lib/client/api";
import { registerAccount } from "@/lib/client/session";
import { MIN_PIN_LENGTH } from "@/lib/crypto/kdf";
import { parseCop } from "@/lib/cop";

type GroupErrors = Partial<Record<"groupName" | "priceCap" | "expectedSize" | "eventDate", string>>;

export default function Crear() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [priceCap, setPriceCap] = useState("$60.000");
  const [expectedSize, setExpectedSize] = useState("12");
  const [values, setValues] = useState<AccountValues>({ name: "", email: "", pin: "" });
  const [errors, setErrors] = useState<FieldErrors & GroupErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: FieldErrors & GroupErrors = {};
    const cap = parseCop(priceCap);
    const size = Number(expectedSize);
    if (!groupName.trim()) next.groupName = "Ponle un nombre al grupo";
    if (cap === null || cap < 1000) next.priceCap = "Escribe un tope válido, por ejemplo $60.000";
    if (!Number.isInteger(size) || size < 2 || size > 50) next.expectedSize = "Entre 2 y 50 personas";
    if (!values.name.trim()) next.name = "Escribe tu nombre";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Escribe un correo válido";
    if (values.pin.length < MIN_PIN_LENGTH) next.pin = `Mínimo ${MIN_PIN_LENGTH} caracteres`;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const account = await registerAccount(values);
      const r = await apiFetch("/api/groups", "POST", {
        groupName: groupName.trim(),
        eventDate: eventDate || undefined,
        priceCap: cap,
        expectedSize: size,
        ...account,
      });
      if (r.ok) {
        router.push("/grupo");
        return;
      }
      if (r.field && r.field in { name: 1, email: 1, pin: 1, groupName: 1, priceCap: 1, expectedSize: 1, eventDate: 1 }) {
        setErrors({ [r.field]: r.error });
      } else {
        setFormError(r.error);
      }
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
          <Field id="personas" label="¿Cuántas personas son?" type="number" inputMode="numeric" min={2} max={50}
            hint="Contigo incluido. El sorteo se habilita cuando todos se hayan unido."
            value={expectedSize} onChange={(e) => setExpectedSize(e.target.value)} error={errors.expectedSize} />
        </div>

        <div className="stack">
          <AccountFields values={values} errors={errors} onChange={(p) => setValues((v) => ({ ...v, ...p }))} />
        </div>

        {formError && (
          <span role="alert" className="error">
            {formError}
          </span>
        )}

        <div className="push stack" style={{ alignItems: "center", gap: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creando tu llave secreta…" : "Crear grupo"}
          </button>
          <Button variant="link" href="/unirse">
            Ya tengo un código de grupo
          </Button>
        </div>
      </form>
    </main>
  );
}
