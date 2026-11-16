// Falling snow over every screen. Fixed, non-interactive, transform-only animation; hidden when the user prefers reduced motion.
const FLAKES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 5 + ((i * 5) % 7),
  dur: 9 + ((i * 3) % 8),
  delay: -((i * 2.3) % 12),
  sway: 12 + ((i * 7) % 22),
}));

export default function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="flake"
          style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, "--sway": `${f.sway}px` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
