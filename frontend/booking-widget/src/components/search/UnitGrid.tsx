import { useTranslation } from "react-i18next";
import { UnitCard } from "./UnitCard";
import type { UnitListing } from "../../lib/unit-types";

type UnitGridProps = {
  units: UnitListing[];
};

export function UnitGrid({ units }: UnitGridProps) {
  return (
    <div className="grid grid-cols-1 gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
      {units.map((unit, index) => (
        <UnitCard key={unit.id} unit={unit} index={index} />
      ))}
    </div>
  );
}

export function UnitGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx}>
          <div className="aspect-[4/3] w-full animate-pulse bg-stone" />
          <div className="mt-5 flex items-start justify-between gap-6">
            <div className="flex-1 space-y-3">
              <div className="h-2 w-20 animate-pulse bg-stone" />
              <div className="h-5 w-3/4 animate-pulse bg-stone" />
              <div className="h-3 w-1/2 animate-pulse bg-stone" />
            </div>
            <div className="space-y-2 text-right">
              <div className="h-2 w-10 animate-pulse bg-stone" />
              <div className="h-6 w-16 animate-pulse bg-stone" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function UnitGridEmpty({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="border border-stone bg-cream-50 p-12 text-center">
      <span className="pl-gold-rule" />
      <h3 className="mt-6 font-display text-3xl text-charcoal">{t("listing.empty.title")}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-charcoal-500">{t("listing.empty.body")}</p>
      <button type="button" onClick={onReset} className="pl-btn-ghost mt-8">
        <span>{t("listing.empty.reset")}</span>
      </button>
    </div>
  );
}
