import { ListingCardData } from "../pages/UnitListingPage";
import { ImageCarousel } from "./ImageCarousel";

type UnitCardProps = {
  data: ListingCardData;
  className?: string;
  variant?: "default" | "hero";
};

// Editorial property card. The wrapper locks the aspect ratio so the image
// never breaks the grid again. `variant="hero"` is used by the asymmetric
// featured-lofts grid for the oversized card on the left column.

export function UnitCard({ data, className = "", variant = "default" }: UnitCardProps) {
  const currency = data.currencySymbol ?? "$";
  const priceLabel = data.pricePerNight.toLocaleString("en-US");
  const aspectClass =
    variant === "hero"
      ? "aspect-[4/5] md:aspect-[3/4] lg:aspect-[4/5]"
      : "aspect-[3/4]";

  return (
    <article className={`group block w-full ${className}`.trim()}>
      <div className={`relative w-full overflow-hidden bg-stone ${aspectClass}`}>
        <ImageCarousel images={data.images} alt={data.title} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/55 via-charcoal/0 to-charcoal/0 opacity-80 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Floating price label */}
        <div className="absolute left-5 top-5 flex items-center gap-2 border border-cream/30 bg-cream/10 px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.2em] text-cream backdrop-blur">
          <span className="h-1 w-1 rounded-full bg-gold" />
          Disponible
        </div>

        {/* Bottom-left title strip */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 md:p-6">
          <div className="min-w-0">
            {data.subtitle ? (
              <div className="mb-2 truncate text-[0.625rem] font-medium uppercase tracking-[0.22em] text-cream/80">
                {data.subtitle}
              </div>
            ) : null}
            <h3 className="font-display text-2xl leading-tight text-cream md:text-3xl">
              {data.title}
            </h3>
          </div>
          <span className="ml-4 hidden shrink-0 md:block">
            <span className="flex h-10 w-10 items-center justify-center border border-cream/50 text-cream transition-all duration-500 group-hover:-translate-y-1 group-hover:bg-cream group-hover:text-charcoal">
              <ArrowRight />
            </span>
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          {data.meta ? (
            <div className="truncate text-xs text-charcoal-500">{data.meta}</div>
          ) : null}
          {data.cancellationText ? (
            <div className="mt-1 text-[0.6875rem] uppercase tracking-[0.18em] text-gold-dark">
              {data.cancellationText}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[0.625rem] uppercase tracking-[0.22em] text-charcoal-400">
            Desde
          </div>
          <div className="mt-1 flex items-baseline justify-end gap-1">
            {data.originalPricePerNight != null ? (
              <span className="text-xs text-charcoal-400 line-through">
                {currency}
                {data.originalPricePerNight.toLocaleString("en-US")}
              </span>
            ) : null}
            <span className="font-display text-2xl leading-none text-charcoal">
              {currency}
              {priceLabel}
            </span>
            <span className="text-[0.625rem] uppercase tracking-[0.2em] text-charcoal-400">
              /noche
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}
