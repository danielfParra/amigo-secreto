import Button from "@/components/Button";
import Clouds from "@/components/Clouds";
import Pack from "@/components/Pack";
import { Bell, Candy, Gift, Tree } from "@/components/Icons";

const STICKERS = [
  { n: "07", who: "Tú", tone: "tone-yellow", style: { left: 0, top: 6, "--tilt": "-7deg", "--i": 2 } },
  { n: "12", who: "¿Quién?", tone: "tone-red", style: { right: 0, top: 84, "--tilt": "6deg", "--i": 4 } },
  { n: "03", who: "Shh…", tone: "tone-green", style: { left: 10, top: 214, "--tilt": "4deg", "--i": 6 } },
] as const;

export default function Inicio() {
  return (
    <main className="screen screen-hero" style={{ alignItems: "center", paddingTop: "calc(44px + env(safe-area-inset-top))" }}>
      <Clouds variant="inicio" />
      <h1 className="hero-title anim-fadeup">
        ¿Quién te <em>tocará</em> este año?
      </h1>

      <div className="collage" aria-hidden="true"><div className="collage-inner">
        <Pack style={{ left: "50%", top: 20, marginLeft: -84, zIndex: 2 }} />
        <Tree size={64} className="collage-icon bob" style={{ left: 2, top: 120, "--r": "-6deg" } as React.CSSProperties} />
        <Bell size={48} className="collage-icon" style={{ right: 14, top: 8 }} />
        <Gift size={52} className="collage-icon bob" style={{ right: 4, top: 230, "--r": "5deg" } as React.CSSProperties} />
        <Candy size={44} className="collage-icon bob" style={{ left: "50%", top: 262, marginLeft: -22, "--r": "-10deg" } as React.CSSProperties} />
        {STICKERS.map((s) => (
          <div key={s.n} className={`sticker ${s.tone}`} style={{ ...s.style, width: 132 } as React.CSSProperties}>
            <span className="num">N.º {s.n}</span>
            <span className="who">{s.who}</span>
          </div>
        ))}
      </div></div>

      <div className="stack anim-fadeup" style={{ width: "100%", alignItems: "center", gap: 6, animationDelay: "0.5s" }}>
        <Button href="/unirse">Empezar</Button>
        <Button variant="link" href="/entrar">
          Ya tengo cuenta
        </Button>
      </div>
    </main>
  );
}
