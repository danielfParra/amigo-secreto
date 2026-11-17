import { Gift } from "./Icons";

/** A big wrapped gift for the "open your result" screen. Decorative: the surrounding screen carries the meaning. */
export default function Pack({ style }: { style?: React.CSSProperties }) {
  return (
    <div role="img" aria-label="Un regalo sin abrir" style={{ ...style, filter: "drop-shadow(0 12px 14px rgb(10 40 28 / 0.3))" }} className="bob">
      <Gift size={190} />
    </div>
  );
}
