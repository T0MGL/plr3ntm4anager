import { Link } from "react-router";

const LOGO_GOLD_ISO =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png";
const LOGO_WHITE_ISO =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/logo-park-lofts-white.svg";

type LogoProps = {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  withBadge?: boolean;
  className?: string;
  linkTo?: string;
};

// Lockup: isotype from the official Park Lofts R2 brand bucket + Cormorant
// wordmark that matches the main site typography + a thin vertical divider
// + a "RENT" label in DM Sans with ultra-wide tracking. The RENT label is
// what turns the identity into a sub-brand without creating a new logo.
// Re-usable: swap the label later for SELL, RESALE, etc, and everything
// downstream still works.

export function Logo({
  variant = "dark",
  size = "md",
  withBadge = true,
  className = "",
  linkTo = "/",
}: LogoProps) {
  const isDark = variant === "dark";
  const wordmarkColor = isDark ? "text-charcoal" : "text-cream";
  const dividerColor = isDark ? "bg-charcoal/25" : "bg-cream/40";
  const iso = isDark ? LOGO_GOLD_ISO : LOGO_WHITE_ISO;

  const dimensions = {
    sm: { iso: 28, wordmark: "text-lg md:text-xl", gap: "gap-2.5" },
    md: { iso: 36, wordmark: "text-xl md:text-2xl", gap: "gap-3" },
    lg: { iso: 48, wordmark: "text-3xl md:text-4xl", gap: "gap-4" },
  }[size];

  const content = (
    <div className={`flex items-center ${dimensions.gap} ${className}`.trim()}>
      <img
        src={iso}
        alt=""
        width={dimensions.iso}
        height={dimensions.iso}
        className="shrink-0"
        style={{ width: dimensions.iso, height: "auto" }}
        aria-hidden
      />
      <div className="flex items-center gap-3">
        <span
          className={`font-display font-medium leading-none tracking-[-0.01em] ${dimensions.wordmark} ${wordmarkColor}`}
        >
          Park Lofts
        </span>
        {withBadge ? (
          <>
            <span className={`h-5 w-px ${dividerColor}`} aria-hidden />
            <span
              className="font-sans text-[0.625rem] font-medium uppercase leading-none tracking-[0.32em] text-gold"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Rent
            </span>
          </>
        ) : null}
      </div>
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
