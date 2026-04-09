import { format } from "date-fns";
import { requestJson } from "./client";

export type UnitSummary = {
  id: string;
  name: string;
  description: string | null;
  nightly_rate_usd: number;
  max_guests: number;
  airbnb_listing_url?: string | null;
  airbnb_ical_url?: string | null;
  image_urls: string[] | null;
  status?: "active" | "inactive" | string;
  category?: string | null;
  place_type?: string | null;
  country?: string | null;
  street_address?: string | null;
  floor?: string | number | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  home_precise?: boolean | null;
  bedroom_lock?: boolean | null;
  private_bathroom?: number | null;
  dedicated_bathroom?: number | null;
  shared_bathroom?: number | null;
  bathroom_usage?: string | null;
  favorites?: string[] | null;
  amenities?: string[] | null;
  safety_items?: string[] | null;
  highlights?: string[] | null;
  safety_details?: string[] | null;
  weekday_price?: number | null;
  weekday_after_tax_price?: number | null;
  bedrooms?: number | null;
  beds?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type UnitAvailability = {
  blocked_dates: string[];
  last_sync_at: string | null;
};

export async function getUnits(): Promise<UnitSummary[]> {
  return requestJson<UnitSummary[]>("/units");
}

export async function getUnitById(unitId: string): Promise<UnitSummary> {
  return requestJson<UnitSummary>(`/units/${unitId}`);
}

export async function getUnitAvailability(
  unitId: string,
  startDate: Date,
  endDate: Date,
): Promise<UnitAvailability> {
  const params = new URLSearchParams({
    start_date: format(startDate, "yyyy-MM-dd"),
    end_date: format(endDate, "yyyy-MM-dd"),
  });

  return requestJson<UnitAvailability>(`/units/${unitId}/availability?${params.toString()}`);
}
