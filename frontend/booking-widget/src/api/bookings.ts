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

export type CancelBookingResponse =
  | { cancelled: true; reason: string }
  | { cancelled: false; reason: string };

export async function cancelBookingRequest(bookingId: string): Promise<CancelBookingResponse> {
  const API_BASE_URL =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "http://localhost:3000/api";

  const res = await fetch(`${API_BASE_URL}/booking-request/${bookingId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    return { cancelled: false, reason: `http_${res.status}` };
  }

  return (await res.json()) as CancelBookingResponse;
}
