import { Holly } from "./Icons";

/** Decorative backdrop: the dotted grid of an album page plus a corner of holly (kept under its old name so every screen keeps working). */
export default function Clouds({ variant = "soft" }: { variant?: "inicio" | "soft" }) {
  const dot = variant === "inicio" ? "rgb(255 255 255 / 0.22)" : "rgb(35 56 245 / 0.12)";
  return (
    <div
      className="clouds"
      aria-hidden="true"
      style={{ backgroundImage: `radial-gradient(circle, ${dot} 1.5px, transparent 1.6px)`, backgroundSize: "22px 22px" }}
    >
      <Holly size={64} className="deco deco-holly" />
    </div>
  );
}
