/** Christmas icons drawn as SVG (no emoji). Decorative: always aria-hidden. */
type P = { size?: number; className?: string; style?: React.CSSProperties };

const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": true as const, focusable: false as const });

/** Six-armed snowflake. White with a pine-green shadow so it reads on paper and on the dark cover. */
export function Snowflake({ size = 40, className, style }: P) {
  const arm = "M24 4v40M24 12l-5-5M24 12l5-5M24 36l-5 5M24 36l5 5";
  return (
    <svg {...base(size)} className={className} style={style} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
      <g>
        <path d={arm} />
        <path d={arm} transform="rotate(60 24 24)" />
        <path d={arm} transform="rotate(120 24 24)" />
      </g>
    </svg>
  );
}

/** A snow-dusted pine in layered boughs. */
export function Pine({ size = 40, className, style }: P) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 48 60" aria-hidden focusable={false} className={className} style={style}>
      <rect x="21" y="48" width="6" height="11" rx="1.5" fill="#6b4226" />
      <path d="M24 2 36 19h-6l10 14h-8l11 15H5l11-15H8l10-14h-6z" fill="#0b5d3b" />
      <path d="M24 2 29.5 10 24 12 18.5 10zM12 19l4.5 5.5-4 .5zM36 19l-4.5 5.5 4 .5zM8 33l5 5-4.5.5zM40 33l-5 5 4.5.5z" fill="#fff" />
      <path d="M24 2 36 19h-6l10 14h-8l11 15H5l11-15H8l10-14h-6z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

export function Tree({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="21" y="38" width="6" height="8" rx="1" fill="#6b4226" />
      <path d="M24 6 36 20h-5l8 11H9l8-11h-5z" fill="#0b8a52" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 2l2.3 4.6 5 .7-3.6 3.5.9 5L24 13.4l-4.6 2.4.9-5-3.6-3.5 5-.7z" fill="#f2c230" stroke="#b07d0a" strokeWidth="1.6" strokeLinejoin="round" className="twinkle" />
      <circle cx="19" cy="27" r="2.3" fill="#c8102e" className="lamp" />
      <circle cx="29" cy="25" r="2.3" fill="#fff" className="lamp l2" />
      <circle cx="24" cy="32" r="2.3" fill="#ff8da1" className="lamp l3" />
    </svg>
  );
}

export function Star({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M24 3l5.6 12.2 13.3 1.5-9.9 9 2.8 13.1L24 32l-11.8 6.8 2.8-13.1-9.9-9 13.3-1.5z" fill="#f2c230" stroke="#b07d0a" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Bell({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={`${className ?? ""} swing`} style={style}>
      <path d="M24 5a3 3 0 0 1 3 3v1.4c5.4 1.3 9 6 9 11.6v6l4 5.5H8L12 27v-6c0-5.6 3.6-10.3 9-11.6V8a3 3 0 0 1 3-3z" fill="#c8102e" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="24" cy="39" r="4" fill="#fff" stroke="#c8102e" strokeWidth="2" />
    </svg>
  );
}

export function Gift({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="7" y="19" width="34" height="23" rx="3" fill="#0b5d3b" stroke="#fff" strokeWidth="2.5" />
      <rect x="5" y="14" width="38" height="9" rx="3" fill="#0e6b3f" stroke="#fff" strokeWidth="2.5" />
      <rect x="21" y="14" width="6" height="28" fill="#c8102e" />
      <path d="M24 14c-6-8-14-5-11-1 2 3 8 1 11 1zM24 14c6-8 14-5 11-1-2 3-8 1-11 1z" fill="#c8102e" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Holly({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M24 26c-3-9-12-13-19-9 2 9 11 14 19 9zM24 26c3-9 12-13 19-9-2 9-11 14-19 9z" fill="#0b8a52" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="20" cy="30" r="5" fill="#c8102e" stroke="#fff" strokeWidth="2" />
      <circle cx="29" cy="31" r="5" fill="#c8102e" stroke="#fff" strokeWidth="2" />
      <circle cx="24.5" cy="37" r="5" fill="#c8102e" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function Candy({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M16 44V17a8 8 0 0 1 16 0" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
      <path d="M16 44V17a8 8 0 0 1 16 0" fill="none" stroke="#c8102e" strokeWidth="7" strokeLinecap="round" />
      <path d="M16 44V17a8 8 0 0 1 16 0" fill="none" stroke="#fff" strokeWidth="7" strokeDasharray="5 8" />
    </svg>
  );
}

export const ICONS = [Tree, Snowflake, Bell, Gift, Holly, Candy, Star];
