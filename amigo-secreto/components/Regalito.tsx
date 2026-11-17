const TONES = {
  rojo: ["#c8102e", "#a50f1d"],
  verde: ["#0e6b3f", "#0a4d31"],
} as const;

export type RegalitoColor = keyof typeof TONES;

/** Regalito, the smiling gift from the first version, now in Christmas red and pine green with a white ribbon. */
export default function Regalito({ color = "rojo", className = "" }: { color?: RegalitoColor; className?: string }) {
  const [body, lid] = TONES[color];
  return (
    <div className={`regalito ${className}`} role="img" aria-label="Regalito, un regalo con cara sonriente">
      <div className="rg-body" style={{ background: body }} />
      <div className="rg-lid">
        <div className="rg-lid-top" style={{ background: lid }} />
        <div className="rg-band" />
        <div className="rg-loop l" />
        <div className="rg-loop r" />
      </div>
      <div className="rg-eye l" />
      <div className="rg-eye r" />
      <div className="rg-cheek l" />
      <div className="rg-cheek r" />
      <div className="rg-smile" />
    </div>
  );
}
