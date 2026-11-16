import type { CSSProperties, ReactNode } from "react";

export default function Bubble({
  tone = "brown",
  children,
  className = "",
  style,
}: {
  tone?: "red" | "green" | "brown" | "sand";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`bubble tone-${tone} ${className}`} style={style}>
      {children}
    </div>
  );
}
