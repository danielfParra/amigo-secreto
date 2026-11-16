/** Christmas icons drawn as SVG (no emoji). Decorative: always aria-hidden. */
type P = { size?: number; className?: string; style?: React.CSSProperties };

const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": true as const, focusable: false as const });

export function Tree({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="21" y="38" width="6" height="8" rx="1" fill="#7a4a2b" />
      <path d="M24 6 36 20h-5l8 11H9l8-11h-5z" fill="#0b8a5c" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 2l2.3 4.6 5 .7-3.6 3.5.9 5L24 13.4l-4.6 2.4.9-5-3.6-3.5 5-.7z" fill="#ffd60a" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" className="twinkle" />
      <circle cx="19" cy="27" r="2.2" fill="#d91a2b" className="lamp" />
      <circle cx="29" cy="25" r="2.2" fill="#ffd60a" className="lamp l2" />
      <circle cx="24" cy="32" r="2.2" fill="#2338f5" className="lamp l3" />
    </svg>
  );
}

export function Star({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M24 3l5.6 12.2 13.3 1.5-9.9 9 2.8 13.1L24 32l-11.8 6.8 2.8-13.1-9.9-9 13.3-1.5z" fill="#ffd60a" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Bell({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={`${className ?? ""} swing`} style={style}>
      <path d="M24 5a3 3 0 0 1 3 3v1.4c5.4 1.3 9 6 9 11.6v6l4 5.5H8L12 27v-6c0-5.6 3.6-10.3 9-11.6V8a3 3 0 0 1 3-3z" fill="#ffd60a" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="24" cy="39" r="4" fill="#d91a2b" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function Gift({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <rect x="7" y="19" width="34" height="23" rx="3" fill="#d91a2b" stroke="#fff" strokeWidth="2.5" />
      <rect x="5" y="14" width="38" height="9" rx="3" fill="#a50f1d" stroke="#fff" strokeWidth="2.5" />
      <rect x="21" y="14" width="6" height="28" fill="#ffd60a" />
      <path d="M24 14c-6-8-14-5-11-1 2 3 8 1 11 1zM24 14c6-8 14-5 11-1-2 3-8 1-11 1z" fill="#ffd60a" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Holly({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M24 26c-3-9-12-13-19-9 2 9 11 14 19 9zM24 26c3-9 12-13 19-9-2 9-11 14-19 9z" fill="#0b8a5c" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="20" cy="30" r="5" fill="#d91a2b" stroke="#fff" strokeWidth="2" />
      <circle cx="29" cy="31" r="5" fill="#d91a2b" stroke="#fff" strokeWidth="2" />
      <circle cx="24.5" cy="37" r="5" fill="#d91a2b" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function Candy({ size = 40, className, style }: P) {
  return (
    <svg {...base(size)} className={className} style={style}>
      <path d="M16 44V17a8 8 0 0 1 16 0" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
      <path d="M16 44V17a8 8 0 0 1 16 0" fill="none" stroke="#d91a2b" strokeWidth="7" strokeLinecap="round" />
      <path d="M16 44V17a8 8 0 0 1 16 0" fill="none" stroke="#fff" strokeWidth="7" strokeDasharray="5 8" />
    </svg>
  );
}

export const ICONS = [Tree, Star, Bell, Gift, Holly, Candy];
