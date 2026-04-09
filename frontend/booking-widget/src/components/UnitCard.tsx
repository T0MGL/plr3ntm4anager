import { ListingCardData } from "../pages/UnitListingPage";
import { ImageCarousel } from "./ImageCarousel";

export function UnitCard({
  data,
  className = "",
}: {
  data: ListingCardData;
  className?: string;
}) {
  const currency = data.currencySymbol ?? "$";
  const priceLabel = data.pricePerNight.toLocaleString("es-PY");

  return (
    <div className={`group w-full ${className}`}>
      <div className="relative overflow-hidden">
        <div className="aspect-[4/5] w-full bg-stone">
          <ImageCarousel images={data.images} alt={data.title} />
        </div>
      </div>

      <div className="mt-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="truncate font-display text-xl text-charcoal transition-colors duration-300 group-hover:text-gold">
            {data.title}
          </div>
          {data.subtitle ? (
            <div className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-charcoal-400">
              {data.subtitle}
            </div>
          ) : null}
          {data.meta ? (
            <div className="mt-2 truncate text-sm text-charcoal-500">
              {data.meta}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2 text-charcoal">
        {data.originalPricePerNight != null ? (
          <span className="text-sm text-charcoal-400 line-through">
            {currency}
            {data.originalPricePerNight.toLocaleString("es-PY")}
          </span>
        ) : null}
        <span className="font-display text-lg">
          {currency}
          {priceLabel}
        </span>
        <span className="text-xs uppercase tracking-[0.18em] text-charcoal-400">
          por noche
        </span>
      </div>

      {data.cancellationText ? (
        <div className="mt-1 text-xs text-charcoal-400">
          {data.cancellationText}
        </div>
      ) : null}
    </div>
  );
}
