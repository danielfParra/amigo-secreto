"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Clouds from "@/components/Clouds";
import { markOnboarded } from "@/components/FirstVisit";
import { Bell, Gift, Snowflake, Star } from "@/components/Icons";
import Regalito from "@/components/Regalito";

const SPLASH_MS = 2800;
const BURST = [
  { x: -120, y: -90, s: 26, d: 0 },
  { x: 120, y: -80, s: 22, d: 0.08 },
  { x: -140, y: 10, s: 18, d: 0.16 },
  { x: 140, y: 20, s: 28, d: 0.04 },
  { x: -70, y: -140, s: 20, d: 0.12 },
  { x: 75, y: -150, s: 24, d: 0.2 },
];

function Splash() {
  return (
    <div className="ob-splash" aria-hidden="true">
      <div className="ob-splash-stage">
        {BURST.map((b, i) => (
          <Snowflake key={i} size={b.s} className="ob-burst" style={{ "--x": `${b.x}px`, "--y": `${b.y}px`, animationDelay: `${0.9 + b.d}s` } as React.CSSProperties} />
        ))}
        <Star size={34} className="ob-star" />
        {[[-100, -120, 18], [105, -118, 16], [-155, -40, 14], [160, -30, 20]].map(([x, y, s], i) => (
          <Star key={i} size={s} className="ob-burst" style={{ "--x": `${x}px`, "--y": `${y}px`, animationDelay: `${1.05 + i * 0.07}s` } as React.CSSProperties} />
        ))}
        <Regalito className="ob-regalito" />
      </div>
      <div className="ob-word">
        {"Amigo secreto".split("").map((c, i) => (
          <span key={i} style={{ animationDelay: `${1.1 + i * 0.045}s` }}>{c === " " ? " " : c}</span>
        ))}
      </div>
    </div>
  );
}

function Lock() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true" className="ob-lock">
      <path d="M30 42V30a18 18 0 0 1 36 0v12" stroke="#0e6b3f" strokeWidth="8" strokeLinecap="round" className="ob-shackle" />
      <rect x="18" y="42" width="60" height="42" rx="12" fill="#c8102e" />
      <circle cx="48" cy="60" r="6" fill="#fff" />
      <path d="M48 64v10" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

const SLIDES = [
  {
    title: "Escribe tus regalos ideales",
    text: "Para cada regalo llenas estos campos. Solo el regalo y el precio son obligatorios.",
    art: (
      <div className="card ob-form" aria-hidden="true">
        <div className="ob-row" style={{ "--i": 0 } as React.CSSProperties}><b>Regalo</b><span>Una planta para la sala</span><i>Obligatorio</i></div>
        <div className="ob-row" style={{ "--i": 1 } as React.CSSProperties}><b>Precio</b><span>$35.000</span><i>Obligatorio</i></div>
        <div className="ob-row" style={{ "--i": 2 } as React.CSSProperties}><b>Enlace</b><span>tienda.com/planta</span><i className="opt">Opcional</i></div>
        <div className="ob-row" style={{ "--i": 3 } as React.CSSProperties}><b>Más detalles</b><span>Maceta blanca, tamaño mediano</span><i className="opt">Opcional</i></div>
      </div>
    ),
  },
  {
    title: "Siempre tres, para mantener la intriga",
    text: "Cada quien escribe tres deseos. Quien te regala elige uno y tú nunca sabrás cuál será. La sorpresa se queda intacta.",
    art: (
      <div className="ob-trio" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <div key={n} className="ob-trio-item" style={{ "--n": n } as React.CSSProperties}>
            <Gift size={74} />
            <span className="ob-q">?</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Todo va cifrado",
    text: "Tu resultado, a quién le regalas, se guarda cifrado. Solo tú lo abres, con tu PIN; ni el servidor puede leerlo. Los chats también van cifrados. Guarda bien tu PIN.",
    art: (
      <div className="ob-vault" aria-hidden="true">
        <Lock />
        <div className="ob-cipher">
          <span>7f3a·c91e·04bd·e2a8</span>
          <span>b6d1·58fa·a3c7·1e90</span>
          <span>29cc·d704·6be3·f5a1</span>
        </div>
      </div>
    ),
  },
  {
    title: "Chats incógnitos",
    text: "Cuando se haga el sorteo, puedes escribirle a tu amigo secreto sin que sepa quién eres: pregúntale por sus gustos o pide ayuda con su regalo si la necesitas. Quien te regala también puede escribirte a ti. Los mensajes van cifrados.",
    art: (
      <div className="ob-chat" aria-hidden="true">
        <div className="msg theirs ob-b1">¿Me ayudas? No sé qué talla usas</div>
        <div className="msg mine ob-b2">Uso talla M. ¡Gracias por preguntar!</div>
        <div className="msg theirs ob-b3">¿Prefieres el color verde o el rojo?</div>
        <Bell size={34} className="ob-bell swing" />
      </div>
    ),
  },
];

export default function Bienvenida() {
  const [splash, setSplash] = useState(true);
  const [i, setI] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const last = i === SLIDES.length - 1;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSplash(false); // eslint-disable-line react-hooks/set-state-in-effect -- reads a browser preference once on mount
      return;
    }
    const t = setTimeout(() => setSplash(false), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)));
  const done = () => markOnboarded();

  return (
    <main
      className="screen"
      style={{ gap: 14 }}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        setTouchX(null);
      }}
    >
      <Clouds />
      {splash && (
        <button type="button" className="ob-skip ob-skip-splash" onClick={() => setSplash(false)}>
          Saltar
        </button>
      )}
      {splash && <Splash />}

      <div className="ob-top">
        <div className="ob-guide"><Regalito /></div>
        <Link href="/" className="ob-skip" onClick={done}>Saltar</Link>
      </div>

      <div className="ob-viewport">
        <div className="ob-track" style={{ transform: `translateX(${-i * 100}%)` }}>
          {SLIDES.map((s, n) => (
            <section key={s.title} className="ob-slide" aria-hidden={n !== i} aria-label={`Paso ${n + 1} de ${SLIDES.length}`} {...(n !== i ? { inert: true } : {})}>
              <h1 className="ob-title">{s.title}</h1>
              <div className="ob-art" key={n === i ? `on-${n}` : `off-${n}`}>{s.art}</div>
              <p className="lede">{s.text}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="ob-dots" role="group" aria-label="Pasos">
        {SLIDES.map((s, n) => (
          <button key={s.title} type="button" className={n === i ? "ob-dot on" : "ob-dot"} aria-label={`Ir al paso ${n + 1}`} aria-current={n === i} onClick={() => go(n)} />
        ))}
      </div>

      {last ? (
        <div className="stack" style={{ alignItems: "center", gap: 6 }}>
          <Link href="/unirse" className="btn btn-primary" onClick={done}>Empezar</Link>
          <Link href="/entrar" className="btn btn-link" onClick={done}>Ya tengo cuenta</Link>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          {i > 0 && <button type="button" className="btn btn-ghost" style={{ width: "36%" }} onClick={() => go(i - 1)}>Atrás</button>}
          <button type="button" className="btn btn-primary" onClick={() => go(i + 1)}>Siguiente</button>
        </div>
      )}
    </main>
  );
}
