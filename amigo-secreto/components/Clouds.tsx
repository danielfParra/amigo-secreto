const PATHS: Record<string, string[]> = {
  inicio: [
    "M-30 250c10-40 62-50 82-20 16-36 78-30 82 10 36-5 52 36 26 52H-30z",
    "M240 560c8-30 50-38 66-14 12-28 60-24 64 8 28-4 40 28 20 40H240z",
    "M300 150c6-22 38-28 50-10 10-20 46-18 48 6 20-3 30 20 14 30H300z",
  ],
  soft: [
    "M250 120c8-30 50-38 66-14 12-28 60-24 64 8 28-4 40 28 20 40H250z",
    "M-30 700c10-40 62-50 82-20 16-36 78-30 82 10 36-5 52 36 26 52H-30z",
  ],
};

/** Decorative outline clouds behind the content (from the sketch). */
export default function Clouds({ variant = "soft" }: { variant?: "inicio" | "soft" }) {
  return (
    <svg
      className={`clouds ${variant === "inicio" ? "anim-drift" : ""}`}
      aria-hidden="true"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMin slice"
      fill="none"
      stroke="#E2DDC8"
      strokeWidth="1.5"
    >
      {PATHS[variant].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
