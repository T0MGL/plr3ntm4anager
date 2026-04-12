import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { getUnits } from "../api/units";
import { useUnitSearchParams } from "../hooks/useUnitSearchParams";
import { applyFilters } from "../lib/unit-filters";
import { toUnitListings } from "../lib/unit-mapper";
import { DEFAULT_FILTERS, type UnitListing } from "../lib/unit-types";
import { SearchBar } from "../components/search/SearchBar";
import { FilterBar } from "../components/search/FilterBar";
import { UnitGrid, UnitGridEmpty, UnitGridSkeleton } from "../components/search/UnitGrid";

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function UnitListingPage() {
  const reduce = useReducedMotion();
  const { t } = useTranslation();
  const { filters, setFilters, resetFilters } = useUnitSearchParams();
  const [units, setUnits] = useState<UnitListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await getUnits();
        if (cancelled) return;
        setUnits(toUnitListings(payload));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : t("listing.errorFallback");
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const visibleUnits = useMemo(() => applyFilters(units, filters), [units, filters]);
  const totalUnits = units.length;
  const visibleCount = visibleUnits.length;

  const hasActiveFilters =
    filters.neighborhoods.length > 0 ||
    filters.guests != null ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.sort !== "featured" ||
    Boolean(filters.checkIn || filters.checkOut);

  const heading =
    loading || totalUnits === 0
      ? t("listing.headingLoading")
      : t(
          visibleCount === 1 ? "listing.headingCountSingular" : "listing.headingCount",
          { count: visibleCount },
        );

  return (
    <div className="relative">
      <section className="border-b border-stone/60 bg-cream pt-10 md:pt-14">
        <div className="pl-container pb-8 md:pb-10">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EXPO_OUT }}
            className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <span className="pl-eyebrow">{t("listing.eyebrow")}</span>
              <h1 className="mt-4 font-display text-4xl leading-[1.05] text-charcoal md:text-5xl lg:text-[3.25rem]">
                {heading}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-charcoal-500">
                {t("listing.description")}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EXPO_OUT }}
            className="mt-7 md:mt-9"
          >
            <SearchBar filters={filters} onChange={setFilters} />
          </motion.div>
        </div>
      </section>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        totalUnits={totalUnits}
        visibleCount={visibleCount}
        loading={loading}
      />

      <section id="results" className="bg-cream pb-24 pt-10 md:pt-14 md:pb-28">
        <div className="pl-container">
          {error ? (
            <div className="border border-stone bg-cream-50 p-12 text-center">
              <h3 className="font-display text-3xl text-charcoal">{t("listing.errorTitle")}</h3>
              <p className="mx-auto mt-3 max-w-md text-sm text-charcoal-500">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="pl-btn-ghost mt-8"
              >
                <span>{t("listing.retry")}</span>
              </button>
            </div>
          ) : loading ? (
            <UnitGridSkeleton />
          ) : visibleCount === 0 ? (
            <UnitGridEmpty onReset={() => (hasActiveFilters ? resetFilters() : setFilters(DEFAULT_FILTERS))} />
          ) : (
            <AnimatePresence mode="popLayout">
              <UnitGrid units={visibleUnits} />
            </AnimatePresence>
          )}
        </div>
      </section>
    </div>
  );
}
