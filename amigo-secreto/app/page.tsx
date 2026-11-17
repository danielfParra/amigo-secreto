import Button from "@/components/Button";
import Clouds from "@/components/Clouds";
import { Candy, Gift, Pine, Snowflake, Star, Tree } from "@/components/Icons";

export default function Inicio() {
  return (
    <main className="screen screen-hero" style={{ alignItems: "center", paddingTop: "calc(44px + env(safe-area-inset-top))" }}>
      <Clouds variant="inicio" />
      <h1 className="hero-title anim-fadeup">
        Celebremos <em>Navidad</em> juntos
      </h1>

      <div className="collage" aria-hidden="true">
        <div className="collage-inner">
          <Pine size={96} className="collage-icon bob" style={{ left: "6%", top: 70, "--r": "-3deg" } as React.CSSProperties} />
          <Tree size={150} className="collage-icon bob" style={{ left: "50%", top: 20, marginLeft: -75, "--r": "0deg", animationDelay: "0.4s" } as React.CSSProperties} />
          <Pine size={80} className="collage-icon bob" style={{ right: "7%", top: 90, "--r": "3deg", animationDelay: "0.8s" } as React.CSSProperties} />
          <Gift size={64} className="collage-icon bob" style={{ left: "14%", top: 220, "--r": "-6deg" } as React.CSSProperties} />
          <Candy size={52} className="collage-icon bob" style={{ left: "50%", top: 236, marginLeft: -26, "--r": "-10deg" } as React.CSSProperties} />
          <Gift size={56} className="collage-icon bob" style={{ right: "14%", top: 228, "--r": "6deg" } as React.CSSProperties} />
          <Star size={30} className="collage-icon twinkle-slow" style={{ left: "30%", top: 6 }} />
          <Star size={22} className="collage-icon twinkle-slow" style={{ right: "26%", top: 40, animationDelay: "0.9s" }} />
          <Star size={18} className="collage-icon twinkle-slow" style={{ left: "4%", top: 190, animationDelay: "0.4s" }} />
          <Snowflake size={44} className="collage-icon spin" style={{ right: 6, top: 0 }} />
          <Snowflake size={30} className="collage-icon spin" style={{ left: 8, top: 14 }} />
        </div>
      </div>

      <div className="stack anim-fadeup" style={{ width: "100%", alignItems: "center", gap: 6, animationDelay: "0.4s" }}>
        <Button href="/unirse">Empezar</Button>
        <Button variant="link" href="/entrar">
          Ya tengo cuenta
        </Button>
        <Button variant="link" href="/bienvenida">
          Cómo funciona
        </Button>
      </div>
    </main>
  );
}
