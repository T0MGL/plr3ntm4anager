import type { UnitSummary } from "../api/units";

export type Unit = UnitSummary;

export type UnitListing = {
  id: string;
  name: string;
  neighborhood: string | null;
  bedrooms: number;
  beds: number;
  maxGuests: number;
  pricePerNightUsd: number;
  images: string[];
  description: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
};

export type UnitFilterState = {
  neighborhoods: string[];
  guests: number | null;
  priceMin: number | null;
  priceMax: number | null;
  sort: UnitSortKey;
  checkIn: string | null;
  checkOut: string | null;
};

export type UnitSortKey = "featured" | "price-asc" | "price-desc" | "bedrooms-desc";

export const DEFAULT_FILTERS: UnitFilterState = {
  neighborhoods: [],
  guests: null,
  priceMin: null,
  priceMax: null,
  sort: "featured",
  checkIn: null,
  checkOut: null,
};

export const KNOWN_NEIGHBORHOODS = [
  "Villa Morra",
  "Recoleta",
  "Las Mercedes",
  "Centro",
  "Aeropuerto",
] as const;

export type KnownNeighborhood = (typeof KNOWN_NEIGHBORHOODS)[number];
