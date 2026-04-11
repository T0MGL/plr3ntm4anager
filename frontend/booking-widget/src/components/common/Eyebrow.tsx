import { ReactNode } from "react";

type EyebrowProps = {
  children: ReactNode;
  tone?: "gold" | "light";
  className?: string;
};

export function Eyebrow({ children, tone = "gold", className = "" }: EyebrowProps) {
  const toneClass = tone === "light" ? "pl-eyebrow pl-eyebrow-light" : "pl-eyebrow";
  return <span className={`${toneClass} ${className}`.trim()}>{children}</span>;
}
