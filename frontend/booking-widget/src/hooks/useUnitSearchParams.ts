import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_FILTERS, type UnitFilterState, type UnitSortKey } from "../lib/unit-types";

const SORT_KEYS: UnitSortKey[] = ["featured", "price-asc", "price-desc", "bedrooms-desc"];

const parseNumber = (raw: string | null): number | null => {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNeighborhoods = (raw: string | null): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const parseSort = (raw: string | null): UnitSortKey => {
  if (raw && (SORT_KEYS as string[]).includes(raw)) return raw as UnitSortKey;
  return "featured";
};

export function useUnitSearchParams(): {
  filters: UnitFilterState;
  setFilters: (next: Partial<UnitFilterState>) => void;
  resetFilters: () => void;
} {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<UnitFilterState>(
    () => ({
      neighborhoods: parseNeighborhoods(params.get("b")),
      guests: parseNumber(params.get("g")),
      priceMin: parseNumber(params.get("min")),
      priceMax: parseNumber(params.get("max")),
      sort: parseSort(params.get("sort")),
      checkIn: params.get("in"),
      checkOut: params.get("out"),
    }),
    [params],
  );

  const setFilters = useCallback(
    (next: Partial<UnitFilterState>) => {
      const merged: UnitFilterState = { ...filters, ...next };
      const search = new URLSearchParams();

      if (merged.neighborhoods.length > 0) search.set("b", merged.neighborhoods.join(","));
      if (merged.guests != null) search.set("g", String(merged.guests));
      if (merged.priceMin != null) search.set("min", String(merged.priceMin));
      if (merged.priceMax != null) search.set("max", String(merged.priceMax));
      if (merged.sort !== "featured") search.set("sort", merged.sort);
      if (merged.checkIn) search.set("in", merged.checkIn);
      if (merged.checkOut) search.set("out", merged.checkOut);

      setParams(search, { replace: true });
    },
    [filters, setParams],
  );

  const resetFilters = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return { filters, setFilters: setFilters as typeof setFilters, resetFilters };
}

export { DEFAULT_FILTERS };
