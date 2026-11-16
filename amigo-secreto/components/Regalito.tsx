const TONES = {
  rosado: ["#F6C6EA", "#EEADDB"],
  azul: ["#BFE4FF", "#9FD3F7"],
  verde: ["#CDEBC0", "#B3DFA1"],
  amarillo: ["#FFE6A3", "#FFD77A"],
} as const;

export type RegalitoColor = keyof typeof TONES;

export default function Regalito({ color = "rosado" }: { color?: RegalitoColor }) {
  const [body, lid] = TONES[color];
  return (
    <div className="regalito" role="img" aria-label="Regalito, un regalo con cara sonriente">
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
