/** A sealed sticker pack (sobre). Decorative: the surrounding screen carries the meaning. */
export default function Pack({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="pack" role="img" aria-label="Un sobre de láminas sin abrir" style={style}>
      <span className="mark">?</span>
      <span className="shine" />
    </div>
  );
}
