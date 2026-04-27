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

export type ResumableResponse =
  | { resumable: true; status: string }
  | { resumable: false; reason: string };

export async function getPublicBookingDetails(bookingId: string): Promise<PublicBookingDetails> {
  return requestJson<PublicBookingDetails>(`/booking-request/${bookingId}/public`);
}

export async function checkBookingResumable(bookingId: string): Promise<ResumableResponse> {
  return requestJson<ResumableResponse>(`/booking-request/${bookingId}/resumable`);
}
