// Falling snowflakes over every screen. Fixed, non-interactive, transform-only animation; hidden when the user prefers reduced motion.
const FLAKES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 12 + ((i * 5) % 14),
  dur: 10 + ((i * 3) % 9),
  delay: -((i * 2.3) % 14),
  sway: 12 + ((i * 7) % 22),
  spin: i % 2 ? 1 : -1,
}));

const ARM = "M12 2v20M12 6l-3-3M12 6l3-3M12 18l-3 3M12 18l3 3";

export default function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="flake"
          style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, "--sway": `${f.sway}px`, "--spin": `${f.spin * 360}deg` } as React.CSSProperties}
        >
          <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <path d={ARM} />
            <path d={ARM} transform="rotate(60 12 12)" />
            <path d={ARM} transform="rotate(120 12 12)" />
          </svg>
        </span>
      ))}
    </div>
  );
}
