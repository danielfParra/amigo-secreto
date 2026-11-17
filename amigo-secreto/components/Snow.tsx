// Falling snowflakes over every screen. Fixed, non-interactive, transform-only animation; hidden when the user prefers reduced motion.
const FLAKES = Array.from({ length: 6 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 12 + ((i * 5) % 14),
  dur: 13 + ((i * 3) % 9),
  delay: -((i * 2.3) % 14),
  sway: 12 + ((i * 7) % 22),
  spin: i % 2 ? 1 : -1,
}));

const ARM = "M12 2v20M12 6l-3-3M12 6l3-3M12 18l-3 3M12 18l3 3";

const STARS = [
  { left: 30, size: 14, dur: 18, delay: -4, sway: 18, spin: 1 },
  { left: 72, size: 16, dur: 22, delay: -11, sway: -14, spin: -1 },
];
const STAR_PATH = "M24 3l5.6 12.2 13.3 1.5-9.9 9 2.8 13.1L24 32l-11.8 6.8 2.8-13.1-9.9-9 13.3-1.5z";

export default function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {STARS.map((s, i) => (
        <span
          key={`s${i}`}
          className="flake"
          style={{ left: `${s.left}%`, width: s.size, height: s.size, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, "--sway": `${s.sway}px`, "--spin": `${s.spin * 360}deg` } as React.CSSProperties}
        >
          <svg viewBox="0 0 48 48" width="100%" height="100%">
            <path d={STAR_PATH} fill="#f2c230" stroke="#b07d0a" strokeWidth="3" strokeLinejoin="round" />
          </svg>
        </span>
      ))}
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
