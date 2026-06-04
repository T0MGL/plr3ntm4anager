import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import {
  getFxRate,
  getPaymentLink,
  startOpenPayment,
} from "../api/payment-links";
import { PayCheckout } from "../components/PayCheckout";

const PYG = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0,
});

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const MIN_USD = 1;
const MAX_USD = 50_000;

// Parse the USD amount out of the /pay/:amount path. Accepts whole numbers and
// up to two decimals (1, 300, 1.5, 49.99). Rejects anything else: zero,
// negatives, more than two decimals, or non-numeric junk like /pay/abc. The
// backend revalidates this same range, so the page check is purely for instant
// feedback, never the authority on what gets charged.
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_USD || value > MAX_USD) return null;
  return value;
}

type View =
  | { status: "loading" }
  | { status: "ready"; amountUsd: number }
  | { status: "paid"; amountUsd: number }
  | { status: "invalid" };

interface Checkout {
  linkId: string;
  processId: string;
  bancardUrl: string;
}

// After the iframe reports completion we poll the link the charge created. The
// Bancard confirmation webhook is the source of truth: an approved charge flips
// the link to `paid`, a denied card (response_code 12 and friends) leaves it
// `active` and we tell the payer to try another card.
const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 8;

const PayPage = () => {
  const { amount: amountParam } = useParams<{ amount: string }>();
  const [searchParams] = useSearchParams();
  const amountUsd = useMemo(() => parseAmount(amountParam), [amountParam]);

  const [view, setView] = useState<View>(() =>
    amountUsd === null ? { status: "invalid" } : { status: "ready", amountUsd },
  );
  const [pygPreview, setPygPreview] = useState<number | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setView(
      amountUsd === null ? { status: "invalid" } : { status: "ready", amountUsd },
    );
    setPygPreview(null);
  }, [amountUsd]);

  // Show the PYG equivalent at the day's FX so the payer sees what the card is
  // charged. This is render-only; the backend recomputes the authoritative PYG
  // when it fires the Single Buy.
  useEffect(() => {
    if (amountUsd === null) return;
    let active = true;
    getFxRate()
      .then((rate) => {
        if (active) setPygPreview(Math.round(amountUsd * rate.effective_rate));
      })
      .catch(() => {
        if (active) setPygPreview(null);
      });
    return () => {
      active = false;
    };
  }, [amountUsd]);

  const handleStart = async () => {
    if (amountUsd === null || starting) return;
    setStarting(true);
    try {
      const result = await startOpenPayment(amountUsd);
      setCheckout({
        linkId: result.link_id,
        processId: result.process_id,
        bancardUrl: result.bancard_url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar el pago.";
      toast.error(message);
    } finally {
      setStarting(false);
    }
  };

  const verifyCharge = useCallback(
    async (linkId: string) => {
      setCheckout(null);
      setVerifying(true);

      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        try {
          const link = await getPaymentLink(linkId);
          if (!mounted.current) return;
          if (link.status === "paid") {
            setVerifying(false);
            setView({ status: "paid", amountUsd: link.amount_usd });
            return;
          }
        } catch {
          // transient: keep polling
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (!mounted.current) return;
      setVerifying(false);
      toast.error(
        "El pago no pudo procesarse con esta tarjeta. La tarjeta fue rechazada, probá con otra.",
      );
    },
    [],
  );

  // Bancard returns to /pay/{linkId}?status=... When this page renders INSIDE
  // the checkout iframe (the return_url load), bridge the result up to the
  // parent window so the open PayCheckout drives verification, then render
  // nothing. The :amount param here is the link id, not a real amount, so we
  // must never fall through to the normal UI in that case.
  const inIframeReturn =
    typeof window !== "undefined" &&
    window.parent !== window &&
    searchParams.get("status") !== null;

  useEffect(() => {
    const status = searchParams.get("status");
    if (!status) return;
    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: "bancard_payment_complete",
          status: status === "success" ? "success" : "cancelled",
        },
        "*",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (inIframeReturn) {
    return null;
  }

  return (
    <section className="pl-container py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        {verifying ? <PaySkeleton /> : null}

        {!verifying && view.status === "ready" ? (
          <ReadyView
            amountUsd={view.amountUsd}
            amountPyg={pygPreview}
            onPay={handleStart}
            starting={starting}
          />
        ) : null}

        {!verifying && view.status === "paid" ? <PaidView amountUsd={view.amountUsd} /> : null}

        {!verifying && view.status === "invalid" ? (
          <NoticeView
            title="Monto de pago inválido"
            body="El enlace no incluye un monto válido. Usá un enlace con el formato /pay/300 o contactanos para que te enviemos el correcto."
          />
        ) : null}
      </div>

      {checkout ? (
        <PayCheckout
          processId={checkout.processId}
          bancardUrl={checkout.bancardUrl}
          onClose={() => setCheckout(null)}
          onSuccess={() => verifyCharge(checkout.linkId)}
        />
      ) : null}
    </section>
  );
};

function ReadyView({
  amountUsd,
  amountPyg,
  onPay,
  starting,
}: {
  amountUsd: number;
  amountPyg: number | null;
  onPay: () => void;
  starting: boolean;
}) {
  return (
    <div>
      <span className="pl-gold-rule" />
      <div className="mt-6 text-[0.6875rem] font-medium uppercase tracking-[0.25em] text-gold">
        Park Lofts
      </div>
      <h1 className="font-display mt-4 text-4xl leading-[1.05] text-charcoal md:text-5xl">
        Pago seguro
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-charcoal-500">
        Revisá el detalle y pagá con tu tarjeta de crédito. La transacción se procesa de forma
        segura a través de Bancard.
      </p>

      <div className="mt-12 border border-stone bg-cream-50 p-8 md:p-10">
        <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
          Concepto
        </div>
        <p className="mt-3 text-lg font-medium text-charcoal">Pago a Park Lofts</p>

        <div className="mt-10 border-t border-stone pt-8">
          <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
            Total a pagar
          </div>
          <div className="font-display mt-3 flex items-baseline gap-2 text-charcoal">
            <span className="text-5xl leading-none md:text-6xl">{USD.format(amountUsd)}</span>
            <span className="text-base text-charcoal-400">USD</span>
          </div>
          <p className="mt-3 text-sm text-charcoal-500">
            {amountPyg !== null
              ? `Se cobrará ${PYG.format(amountPyg)} al tipo de cambio del día.`
              : "El monto se cobra en guaraníes al tipo de cambio del día."}
          </p>
        </div>

        <button
          type="button"
          onClick={onPay}
          disabled={starting}
          className="pl-btn-primary mt-10 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? "Abriendo el pago..." : "Pagar ahora"}
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-charcoal-400">
        ¿Tenés dudas?{" "}
        <Link to="/contacto" className="text-gold underline-offset-4 hover:underline">
          Contactanos
        </Link>
      </p>
    </div>
  );
}

function PaidView({ amountUsd }: { amountUsd: number }) {
  return (
    <div className="text-center">
      <span className="pl-gold-rule" />
      <div className="mt-6 inline-flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.25em] text-gold">
        <CheckIcon className="h-3.5 w-3.5" />
        Pago confirmado
      </div>
      <h1 className="font-display mt-5 text-4xl leading-tight text-charcoal md:text-5xl">
        Gracias, recibimos tu pago
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-charcoal-500">
        Pagaste {USD.format(amountUsd)} a Park Lofts. Guardá esta página como comprobante.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={() => window.print()} className="pl-btn-primary">
          Descargar comprobante
        </button>
        <Link to="/" className="pl-btn-ghost">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

function NoticeView({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center">
      <span className="pl-gold-rule" />
      <h1 className="font-display mt-6 text-4xl leading-tight text-charcoal md:text-5xl">{title}</h1>
      <p className="mt-4 text-sm text-charcoal-500">{body}</p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link to="/" className="pl-btn-primary">
          Ir al inicio
        </Link>
        <Link to="/contacto" className="pl-btn-ghost">
          Contactanos
        </Link>
      </div>
    </div>
  );
}

function PaySkeleton() {
  return (
    <div>
      <div className="h-4 w-24 animate-pulse bg-stone" />
      <div className="mt-6 h-12 w-2/3 animate-pulse bg-stone" />
      <div className="mt-4 h-4 w-1/2 animate-pulse bg-stone" />
      <div className="mt-12 h-72 w-full animate-pulse bg-stone-light" />
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default PayPage;
