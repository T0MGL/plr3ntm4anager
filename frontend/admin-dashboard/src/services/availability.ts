import { api } from '../utils/api';

export type AvailabilitySource = 'airbnb' | 'manual' | 'widget';
export type AvailabilityExternalKind = 'reserved' | 'not_available' | 'blocked' | 'unknown';

export interface AvailabilityRow {
  id: string;
  unit_id: string;
  blocked_date: string;
  source: AvailabilitySource;
  external_kind: AvailabilityExternalKind | null;
  external_ref: string | null;
  guest_last4: string | null;
  guest_alias: string | null;
}

/**
 * Write or clear the human alias for an Airbnb reservation. The server
 * stamps the alias across every night of the reservation range (keyed on
 * external_ref) so the calendar and lists stay consistent. Clearing is done
 * by passing null or an empty string; the server coerces empty to null.
 */
export async function updateGuestAlias(
  availabilityId: string,
  guestAlias: string | null
): Promise<AvailabilityRow> {
  const { data } = await api.patch<AvailabilityRow>(
    `/admin/availability/${availabilityId}`,
    { guest_alias: guestAlias }
  );
  return data;
}
