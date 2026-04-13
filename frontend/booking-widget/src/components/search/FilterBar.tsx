import { useEffect, useMemo, useRef, useState } from "react";
import { IoChevronDown, IoClose } from "react-icons/io5";
import { useTranslation } from "react-i18next";
import { KNOWN_NEIGHBORHOODS, type UnitFilterState, type UnitSortKey } from "../../lib/unit-types";

type FilterBarProps = {
  filters: UnitFilterState;
  onChange: (patch: Partial<UnitFilterState>) => void;
  onReset: () => void;
  totalUnits: number;
  visibleCount: number;
  loading: boolean;
};

const SORT_KEYS: { value: UnitSortKey; labelKey: string }[] = [
  { value: "featured", labelKey: "filterBar.sort.featured" },
  { value: "price-asc", labelKey: "filterBar.sort.priceAsc" },
  { value: "price-desc", labelKey: "filterBar.sort.priceDesc" },
  { value: "bedrooms-desc", labelKey: "filterBar.sort.bedroomsDesc" },
];

const PRICE_MIN = 0;
const PRICE_MAX = 500;
const PRICE_STEP = 10;

export function FilterBar({
  filters,
  onChange,
  onReset,
  totalUnits,
  visibleCount,
  loading,
}: FilterBarProps) {
  const { t } = useTranslation();

  const toggleNeighborhood = (value: string) => {
    const exists = filters.neighborhoods.includes(value);
    const next = exists
      ? filters.neighborhoods.filter((n) => n !== value)
      : [...filters.neighborhoods, value];
    onChange({ neighborhoods: next });
  };

  const clearAll = filters.neighborhoods.length > 0;

  const hasAnyFilter =
    filters.neighborhoods.length > 0 ||
    filters.guests != null ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.sort !== "featured" ||
    Boolean(filters.checkIn || filters.checkOut);

  const countLabel = loading
    ? t("filterBar.loading")
    : t(totalUnits === 1 ? "filterBar.countLabelSingular" : "filterBar.countLabel", {
        visible: visibleCount,
        total: totalUnits,
      });

  return (
    <div className="sticky top-20 z-30 border-b border-stone/60 bg-cream/95 backdrop-blur-md md:top-24">
      <div className="pl-container py-4 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => onChange({ neighborhoods: [] })}
              className={chipClass(filters.neighborhoods.length === 0)}
            >
              {t("filterBar.allNeighborhoods")}
            </button>
            {KNOWN_NEIGHBORHOODS.map((value) => {
              const active = filters.neighborhoods.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleNeighborhood(value)}
                  className={chipClass(active)}
                >
                  {value}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
            <GuestsDropdown value={filters.guests} onChange={(guests) => onChange({ guests })} />
            <PriceDropdown
              min={filters.priceMin}
              max={filters.priceMax}
              onChange={(priceMin, priceMax) => onChange({ priceMin, priceMax })}
            />
            <SortDropdown value={filters.sort} onChange={(sort) => onChange({ sort })} />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-stone/40 pt-3 md:mt-4 md:pt-4">
          <span className="text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-charcoal-400">
            {countLabel}
          </span>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={onReset}
              className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-charcoal-500 transition-colors hover:text-charcoal"
            >
              {t("filterBar.clearFilters")}
            </button>
          ) : (
            clearAll && (
              <button
                type="button"
                onClick={onReset}
                className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-charcoal-500 transition-colors hover:text-charcoal"
              >
                {t("filterBar.clear")}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function chipClass(active: boolean): string {
  return [
    "whitespace-nowrap rounded-full border px-4 py-2 text-[0.6875rem] font-medium uppercase tracking-[0.2em] transition-all duration-300",
    active
      ? "border-charcoal bg-charcoal text-cream"
      : "border-stone-dark/60 bg-cream text-charcoal-500 hover:border-charcoal hover:text-charcoal",
  ].join(" ");
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);
  return containerRef;
}

type GuestsDropdownProps = {
  value: number | null;
  onChange: (value: number | null) => void;
};

function GuestsDropdown({ value, onChange }: GuestsDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useOutsideClose(open, () => setOpen(false));
  const label =
    value == null
      ? t("filterBar.guestsPlaceholder")
      : t("filterBar.guestsValue", { count: value });

  const current = value ?? 0;
  const decrement = () => onChange(current > 1 ? current - 1 : null);
  const increment = () => onChange(Math.min(12, current + 1 || 1));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={dropdownTriggerClass(value != null)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        <IoChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 rounded-xl border border-stone-dark/50 bg-cream p-5 shadow-2xl shadow-charcoal/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-lg text-charcoal">
                {t("filterBar.guestsModal.title")}
              </div>
              <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-charcoal-400">
                {t("filterBar.guestsModal.caption")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={decrement}
                disabled={current <= 0}
                className="flex h-9 w-9 items-center justify-center border border-charcoal/40 text-charcoal transition-all hover:border-gold hover:text-gold disabled:opacity-40"
                aria-label={t("filterBar.guestsModal.decreaseLabel")}
              >
                -
              </button>
              <div className="w-6 text-center font-display text-xl text-charcoal">{current}</div>
              <button
                type="button"
                onClick={increment}
                disabled={current >= 12}
                className="flex h-9 w-9 items-center justify-center border border-charcoal/40 text-charcoal transition-all hover:border-gold hover:text-gold disabled:opacity-40"
                aria-label={t("filterBar.guestsModal.increaseLabel")}
              >
                +
              </button>
            </div>
          </div>
          {value != null ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-5 w-full border-t border-stone pt-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-charcoal-500 hover:text-charcoal"
            >
              {t("filterBar.clear")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type PriceDropdownProps = {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
};

function PriceDropdown({ min, max, onChange }: PriceDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useOutsideClose(open, () => setOpen(false));

  const [localRange, setLocalRange] = useState<{ min: number; max: number }>({
    min: min ?? PRICE_MIN,
    max: max ?? PRICE_MAX,
  });
  const handleOpen = () => {
    setLocalRange({ min: min ?? PRICE_MIN, max: max ?? PRICE_MAX });
    setOpen(true);
  };
  const localMin = localRange.min;
  const localMax = localRange.max;

  const label = useMemo(() => {
    if (min == null && max == null) return t("filterBar.pricePlaceholder");
    if (min != null && max != null) return t("filterBar.priceRange", { min, max });
    if (min != null) return t("filterBar.priceFrom", { min });
    return t("filterBar.priceTo", { max });
  }, [min, max, t]);

  const active = min != null || max != null;

  const handleApply = () => {
    const nextMin = localMin > PRICE_MIN ? localMin : null;
    const nextMax = localMax < PRICE_MAX ? localMax : null;
    onChange(nextMin, nextMax);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null, null);
    setOpen(false);
  };

  const handleMinChange = (next: number) => {
    setLocalRange((prev) => ({ ...prev, min: Math.min(next, prev.max - PRICE_STEP) }));
  };
  const handleMaxChange = (next: number) => {
    setLocalRange((prev) => ({ ...prev, max: Math.max(next, prev.min + PRICE_STEP) }));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className={dropdownTriggerClass(active)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        <IoChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[320px] rounded-xl border border-stone-dark/50 bg-cream p-5 shadow-2xl shadow-charcoal/10">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg text-charcoal">
              {t("filterBar.priceModal.title")}
            </div>
            <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-charcoal-400">
              {t("filterBar.priceModal.currency")}
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between text-sm text-charcoal">
            <span>${localMin}</span>
            <span>${localMax}</span>
          </div>
          <div className="relative mt-2 h-10">
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={localMin}
              onChange={(e) => handleMinChange(Number(e.target.value))}
              className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
              aria-label={t("filterBar.priceModal.minLabel")}
            />
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={localMax}
              onChange={(e) => handleMaxChange(Number(e.target.value))}
              className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
              aria-label={t("filterBar.priceModal.maxLabel")}
            />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-stone pt-4">
            <button
              type="button"
              onClick={handleClear}
              className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-charcoal-500 hover:text-charcoal"
            >
              {t("filterBar.clear")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-gold hover:text-gold-dark"
            >
              {t("filterBar.priceModal.apply")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SortDropdownProps = {
  value: UnitSortKey;
  onChange: (value: UnitSortKey) => void;
};

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useOutsideClose(open, () => setOpen(false));
  const active = value !== "featured";
  const selectedLabelKey = SORT_KEYS.find((opt) => opt.value === value)?.labelKey;
  const label = selectedLabelKey ? t(selectedLabelKey) : t("filterBar.sortFallback");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={dropdownTriggerClass(active)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <IoChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-56 rounded-xl border border-stone-dark/50 bg-cream p-2 shadow-2xl shadow-charcoal/10"
        >
          {SORT_KEYS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected ? "bg-charcoal text-cream" : "text-charcoal hover:bg-stone/60"
                }`}
              >
                <span>{t(opt.labelKey)}</span>
                {isSelected ? <IoClose className="h-4 w-4 rotate-45" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function dropdownTriggerClass(active: boolean): string {
  return [
    "flex items-center gap-2 rounded-full border px-4 py-2 text-[0.6875rem] font-medium uppercase tracking-[0.2em] transition-all duration-300",
    active
      ? "border-charcoal bg-charcoal text-cream"
      : "border-stone-dark/60 bg-cream text-charcoal-500 hover:border-charcoal hover:text-charcoal",
  ].join(" ");
}
