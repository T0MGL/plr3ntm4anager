import { requestJson } from "./client";

export type BookingStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "preauthorized"
  | "completed"
  | "failed"
  | "refunded";

export type PublicBookingDetails = {
  id: string;
  status: BookingStatus;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  total_price_usd: number;
  guest_first_name: string;
  unit_name: string;
  unit_image: string | null;
  payment_status: PaymentStatus | null;
  payment_completed_at: string | null;
};

export async function getPublicBookingDetails(bookingId: string): Promise<PublicBookingDetails> {
  return requestJson<PublicBookingDetails>(`/booking-request/${bookingId}/public`);
}
