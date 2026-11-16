"use client";

import { useState } from "react";
import Regalito from "@/components/Regalito";
import Bubble from "@/components/Bubble";
import Button from "@/components/Button";
import Clouds from "@/components/Clouds";

export default function Inicio() {
  const [run, setRun] = useState(0);
  return (
    <main className="screen" style={{ alignItems: "center", paddingTop: "calc(52px + env(safe-area-inset-top))" }}>
      <Clouds variant="inicio" />
      <h1 className="anim-fadeup" style={{ textAlign: "center", fontSize: 40 }}>
        ¿Quién te tocará este año?
      </h1>

      <div
        key={run}
        style={{ flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
      >
        <Bubble className="anim-pop" style={{ position: "absolute", left: 0, top: 70, animationDelay: "0.7s" }}>
          ¡Hola! Soy Regalito
        </Bubble>
        <Bubble
          tone="green"
          className="anim-pop"
          style={{ position: "absolute", right: 0, bottom: 40, maxWidth: 190, animationDelay: "1.4s" }}
        >
          Te ayudo con el amigo secreto de este año
        </Bubble>
        <Regalito />
      </div>

      <div key={`cta-${run}`} className="stack anim-fadeup" style={{ width: "100%", alignItems: "center", gap: 6, animationDelay: "1.8s" }}>
        <Button href="/unirse">Empezar</Button>
        <Button variant="link" href="/entrar">
          Ya tengo cuenta
        </Button>
        <Button variant="link" onClick={() => setRun((r) => r + 1)}>
          Ver otra vez
        </Button>
      </div>
    </main>
  );
}
