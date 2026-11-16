import type { CSSProperties, ReactNode } from "react";

export default function Bubble({
  tone = "yellow",
  children,
  className = "",
  style,
}: {
  tone?: "yellow" | "blue" | "pink" | "green";
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
