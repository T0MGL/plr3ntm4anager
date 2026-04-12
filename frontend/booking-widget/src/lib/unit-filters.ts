import type { UnitFilterState, UnitListing, UnitSortKey } from "./unit-types";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function filterUnits(units: UnitListing[], filters: UnitFilterState): UnitListing[] {
  const activeNeighborhoods = filters.neighborhoods.map(normalize);

  return units.filter((unit) => {
    if (activeNeighborhoods.length > 0) {
      const unitNeighborhood = unit.neighborhood ? normalize(unit.neighborhood) : "";
      if (!activeNeighborhoods.includes(unitNeighborhood)) return false;
    }
    if (filters.guests != null && unit.maxGuests < filters.guests) return false;
    if (filters.priceMin != null && unit.pricePerNightUsd < filters.priceMin) return false;
    if (filters.priceMax != null && unit.pricePerNightUsd > filters.priceMax) return false;
    return true;
  });
}

export function sortUnits(units: UnitListing[], key: UnitSortKey): UnitListing[] {
  const copy = [...units];
  switch (key) {
    case "price-asc":
      return copy.sort((a, b) => a.pricePerNightUsd - b.pricePerNightUsd);
    case "price-desc":
      return copy.sort((a, b) => b.pricePerNightUsd - a.pricePerNightUsd);
    case "bedrooms-desc":
      return copy.sort((a, b) => b.bedrooms - a.bedrooms);
    case "featured":
    default:
      return copy;
  }
}

export function applyFilters(units: UnitListing[], filters: UnitFilterState): UnitListing[] {
  return sortUnits(filterUnits(units, filters), filters.sort);
}

export function countActiveFilters(filters: UnitFilterState): number {
  let count = 0;
  if (filters.neighborhoods.length > 0) count += 1;
  if (filters.guests != null) count += 1;
  if (filters.priceMin != null || filters.priceMax != null) count += 1;
  if (filters.sort !== "featured") count += 1;
  if (filters.checkIn || filters.checkOut) count += 1;
  return count;
}
