import type { Unit, UnitListing } from "./unit-types";

const FALLBACK_IMAGE =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerlobby.jpeg";

const trim = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out.length > 0 ? out : null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const addressLineFromUnit = (unit: Unit): string | null => {
  const parts = [
    trim(unit.street_address),
    trim(unit.city),
    trim(unit.state),
    trim(unit.country),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
};

const neighborhoodFromUnit = (unit: Unit): string | null => {
  const explicit = trim((unit as Unit & { neighborhood?: string | null }).neighborhood);
  if (explicit) return explicit;
  return trim(unit.state) ?? trim(unit.city);
};

export function toUnitListing(unit: Unit): UnitListing {
  const images = Array.isArray(unit.image_urls)
    ? unit.image_urls.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const price = unit.weekday_price ?? unit.nightly_rate_usd ?? 0;

  const extended = unit as Unit & {
    latitude?: number | string | null;
    longitude?: number | string | null;
    google_maps_url?: string | null;
    neighborhood?: string | null;
  };

  return {
    id: unit.id,
    name: unit.name || "Loft Park Lofts",
    neighborhood: neighborhoodFromUnit(unit),
    bedrooms: Number(unit.bedrooms ?? 0),
    beds: Number(unit.beds ?? 0),
    maxGuests: Number(unit.max_guests ?? 1),
    pricePerNightUsd: Number(price),
    images: images.length > 0 ? images : [FALLBACK_IMAGE],
    description: trim(unit.description),
    addressLine: addressLineFromUnit(unit),
    latitude: toNumberOrNull(extended.latitude),
    longitude: toNumberOrNull(extended.longitude),
    googleMapsUrl: trim(extended.google_maps_url),
  };
}

export function toUnitListings(units: Unit[]): UnitListing[] {
  return units.map(toUnitListing);
}
