import { Link } from "react-router";

const LOGO_GOLD_ISO =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png";
const LOGO_WHITE_LOCKUP =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/logo-park-lofts-white.svg";

type LogoProps = {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  withBadge?: boolean;
  className?: string;
  linkTo?: string;
};

// Two brand assets live in the R2 bucket and they are NOT the same shape.
// LOGO_GOLD_ISO is the square isotype only (no wordmark baked in), so the
// dark variant pairs it with a Cormorant wordmark in markup to produce a
// full lockup. LOGO_WHITE_LOCKUP is already a horizontal lockup with the
// "PARK LOFTS" wordmark embedded in the SVG, so the light variant must NOT
// render a second wordmark on top of it, otherwise the label appears twice
// side by side. The sub-brand "RENT" label plus divider are appended in
// both variants, which is what turns the identity into Park Lofts Rent
// without requiring a separate logo file.

export function Logo({
  variant = "dark",
  size = "md",
  withBadge = true,
  className = "",
  linkTo = "/",
}: LogoProps) {
  const isDark = variant === "dark";
  const wordmarkColor = isDark ? "" : "text-cream";
  const wordmarkStyle = isDark ? { color: "#AA8C69" } : undefined;
  const dividerColor = isDark ? "bg-charcoal/25" : "bg-cream/40";

  const dimensions = {
    sm: { iso: 28, lockupHeight: 18, wordmark: "text-lg md:text-xl", gap: "gap-2.5" },
    md: { iso: 36, lockupHeight: 22, wordmark: "text-xl md:text-2xl", gap: "gap-3" },
    lg: { iso: 48, lockupHeight: 30, wordmark: "text-3xl md:text-4xl", gap: "gap-4" },
  }[size];

  const brandMark = isDark ? (
    <div className="flex items-center gap-3">
      <img
        src={LOGO_GOLD_ISO}
        alt=""
        width={dimensions.iso}
        height={dimensions.iso}
        className="shrink-0"
        style={{ width: dimensions.iso, height: "auto" }}
        aria-hidden
      />
      <span
        className={`font-sans font-semibold leading-none tracking-[0.01em] ${dimensions.wordmark} ${wordmarkColor}`.trim()}
        style={wordmarkStyle}
      >
        Park Lofts
      </span>
    </div>
  ) : (
    <img
      src={LOGO_WHITE_LOCKUP}
      alt=""
      height={dimensions.lockupHeight}
      className="shrink-0"
      style={{ height: dimensions.lockupHeight, width: "auto" }}
      aria-hidden
    />
  );

  const content = (
    <div className={`flex items-center ${dimensions.gap} ${className}`.trim()}>
      {brandMark}
      {withBadge ? (
        <div className="flex items-center gap-3">
          <span className={`h-5 w-px ${dividerColor}`} aria-hidden />
          <span
            className="font-sans text-[0.625rem] font-medium uppercase leading-none tracking-[0.32em] text-gold"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Rent
          </span>
        </div>
      ) : null}
    </div>
  );

  if (!linkTo) {
    return (
      <span className="inline-flex" aria-label="Park Lofts Rent">
        {content}
      </span>
    );
  }

  return (
    <Link to={linkTo} aria-label="Park Lofts Rent" className="inline-flex">
      {content}
    </Link>
  );
}
