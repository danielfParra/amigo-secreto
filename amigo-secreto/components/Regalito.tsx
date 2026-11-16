const TONES = {
  rojo: ["#A60B08", "#5E0001"],
  verde: ["#1D2E19", "#5E0001"],
  cafe: ["#76584C", "#5A4238"],
  vino: ["#5E0001", "#A60B08"],
} as const;

export type RegalitoColor = keyof typeof TONES;

export default function Regalito({ color = "rojo" }: { color?: RegalitoColor }) {
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
