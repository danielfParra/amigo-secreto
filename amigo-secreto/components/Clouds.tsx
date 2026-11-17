import { Holly, Pine, Star } from "./Icons";

// A tile with two tiny snowflakes, used as the page texture.
const tile = (color: string, opacity: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72' fill='none' stroke='${color}' stroke-opacity='${opacity}' stroke-width='1.6' stroke-linecap='round'>` +
      `<g transform='translate(14 16)'><path d='M0-6v12M-5.2-3l10.4 6M-5.2 3l10.4-6'/></g>` +
      `<g transform='translate(52 50) scale(.7)'><path d='M0-6v12M-5.2-3l10.4 6M-5.2 3l10.4-6'/></g></svg>`,
  )}")`;

const FOREST = [
  { left: -2, size: 44, bottom: 0 },
  { left: 9, size: 66, bottom: -6 },
  { left: 24, size: 38, bottom: 2 },
  { left: 36, size: 58, bottom: -4 },
  { left: 52, size: 42, bottom: 0 },
  { left: 63, size: 70, bottom: -8 },
  { left: 79, size: 40, bottom: 2 },
  { left: 90, size: 56, bottom: -4 },
];

/** Decorative backdrop: snowflake texture, a row of snowy pines along the bottom and a holly corner (kept under its old name so every screen keeps working). */
export default function Clouds({ variant = "soft" }: { variant?: "inicio" | "soft" }) {
  const hero = variant === "inicio";
  return (
    <div
      className="clouds"
      aria-hidden="true"
      style={{ backgroundImage: hero ? tile("#ffffff", 0.2) : tile("#0e6b3f", 0.16), backgroundSize: "72px 72px" }}
    >
      <div className="forest" style={{ opacity: hero ? 0.32 : 0.2 }}>
        {FOREST.map((t, i) => (
          <Pine key={i} size={t.size} style={{ position: "absolute", left: `${t.left}%`, bottom: t.bottom }} />
        ))}
      </div>
      <Holly size={64} className="deco deco-holly" />
      <Star size={22} className="deco gold-star twinkle-slow" style={{ left: "9%", top: 118 }} />
      <Star size={15} className="deco gold-star twinkle-slow" style={{ right: "12%", top: "42%", animationDelay: "0.8s" }} />
      <Star size={18} className="deco gold-star twinkle-slow" style={{ left: "6%", top: "58%", animationDelay: "1.5s" }} />
      <Star size={13} className="deco gold-star twinkle-slow" style={{ right: "26%", top: "22%", animationDelay: "0.3s" }} />
    </div>
  );
}
