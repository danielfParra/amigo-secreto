import Link from "next/link";
import Button from "@/components/Button";
import Clouds from "@/components/Clouds";

const icon = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const POINTS = [
  { tone: "tone-brown", title: "Tu llave es solo tuya", body: "Se crea en tu celular cuando te unes.", svg: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9" /><path d="M17 6l3 3" /></> },
  { tone: "tone-green", title: "Cada resultado va cifrado", body: "Solo se abre con la llave de su dueño.", svg: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></> },
  { tone: "tone-red", title: "El organizador no ve nada", body: "Solo sabe que el sorteo ya se hizo.", svg: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></> },
  { tone: "tone-sand", title: "Nadie se saca a sí mismo", body: "Todos dan y reciben un regalo.", svg: <path d="M20 6L9 17l-5-5" /> },
];

export default function Privacidad() {
  return (
    <main className="screen" style={{ gap: 24 }}>
      <Clouds />
      <Link href="/grupo" className="back" aria-label="Volver al grupo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      <div className="stack" style={{ gap: 10 }}>
        <h1 style={{ fontSize: 38 }}>Tu secreto está a salvo</h1>
        <p className="lede">Nadie ve los emparejamientos, ni quien creó el grupo.</p>
      </div>

      <ul className="stack" style={{ gap: 18, listStyle: "none" }}>
        {POINTS.map((p) => (
          <li key={p.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span className={p.tone} style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg {...icon}>{p.svg}</svg>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{p.title}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, color: "var(--muted)" }}>{p.body}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="push">
        <Button href="/sorteo">Entendido</Button>
      </div>
    </main>
  );
}
