import { requestJson } from "./client";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000/api";

export type PaymentLinkStatus = "active" | "paid" | "expired";

export interface PublicPaymentLink {
  id: string;
  amount_usd: number;
  amount_pyg: number;
  concept: string;
  status: PaymentLinkStatus;
  expired: boolean;
}

export interface StartPaymentResult {
  process_id: string;
  shop_process_id: number;
  bancard_url: string;
}

export async function getPaymentLink(id: string): Promise<PublicPaymentLink> {
  return requestJson<PublicPaymentLink>(`/payments/links/${id}`);
}

export async function startPaymentLinkCheckout(id: string): Promise<StartPaymentResult> {
  const res = await fetch(`${API_BASE_URL}/payments/links/${id}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const payload = (await res.json().catch(() => ({}))) as
    | StartPaymentResult
    | { error?: string };

  if (!res.ok) {
    const message =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `No se pudo iniciar el pago (${res.status})`;
    throw new Error(message);
  }

  return payload as StartPaymentResult;
}
