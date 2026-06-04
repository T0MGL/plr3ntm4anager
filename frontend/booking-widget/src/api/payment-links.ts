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

export interface OpenPaymentResult {
  process_id: string;
  shop_process_id: number;
  bancard_url: string;
  link_id: string;
  amount_usd: number;
  amount_pyg: number;
}

export interface FxRate {
  effective_rate: number;
}

export async function getFxRate(): Promise<FxRate> {
  return requestJson<FxRate>("/payments/fx");
}

export async function getPaymentLink(id: string): Promise<PublicPaymentLink> {
  return requestJson<PublicPaymentLink>(`/payments/links/${id}`);
}

export interface LinkPaymentStart {
  process_id: string;
  shop_process_id: number;
  bancard_url: string;
}

// Starts a Bancard Single Buy for an admin-created link. The amount and concept
// are fixed server-side from the link, so the page only sends the id. Mirrors
// startOpenPayment but for the /pay/:linkId entry the admin shares.
export async function startLinkPayment(linkId: string): Promise<LinkPaymentStart> {
  const res = await fetch(`${API_BASE_URL}/payments/links/${linkId}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const payload = (await res.json().catch(() => ({}))) as
    | LinkPaymentStart
    | { error?: string };

  if (!res.ok) {
    const message =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `No se pudo iniciar el pago (${res.status})`;
    throw new Error(message);
  }

  return payload as LinkPaymentStart;
}

// Absolute URL for the server-rendered comprobante PDF. The endpoint emits only
// when the link is paid, so it is safe to surface this on the result screen.
export function receiptUrl(linkId: string): string {
  return `${API_BASE_URL}/payments/links/${linkId}/receipt`;
}

// Starts an open card payment for the public /pay/:amount page. The USD amount
// is parsed from the URL by the widget; the backend revalidates it, converts to
// PYG at the day's FX, and returns the Bancard process to feed the iframe.
export async function startOpenPayment(amountUsd: number): Promise<OpenPaymentResult> {
  const res = await fetch(`${API_BASE_URL}/payments/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount_usd: amountUsd }),
  });

  const payload = (await res.json().catch(() => ({}))) as
    | OpenPaymentResult
    | { error?: string };

  if (!res.ok) {
    const message =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `No se pudo iniciar el pago (${res.status})`;
    throw new Error(message);
  }

  return payload as OpenPaymentResult;
}
