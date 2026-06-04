import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import {
  getFxRate,
  getPaymentLink,
  startLinkPayment,
  startOpenPayment,
  type PublicPaymentLink,
} from "../api/payment-links";
import { PayCheckout } from "../components/PayCheckout";
import { useNoIndex } from "../hooks/useNoIndex";

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The /pay/:param route serves two entrypoints off one path:
//  - a numeric param is an open amount in USD (e.g. /pay/300), charged ad hoc.
//  - a UUID param is an admin-created payment link (e.g. /pay/<linkId>), which
//    carries a fixed amount and concept the admin set. This is the link the
//    dashboard "copy link" button hands out, so the path must resolve it as a
//    link, not parse the UUID as an amount (which rendered "Monto invalido").
type Source =
  | { kind: "amount"; amountUsd: number }
  | { kind: "link"; linkId: string }
  | { kind: "invalid" };

function resolveSource(raw: string | undefined): Source {
  if (!raw) return { kind: "invalid" };
  if (UUID_RE.test(raw)) return { kind: "link", linkId: raw };
  if (/^\d+(\.\d{1,2})?$/.test(raw)) {
    const value = Number(raw);
    if (Number.isFinite(value) && value >= MIN_USD && value <= MAX_USD) {
      return { kind: "amount", amountUsd: value };
    }
  }
  return { kind: "invalid" };
}

type View =
  | { status: "loading" }
  | { status: "ready"; amountUsd: number; amountPyg: number | null; concept: string }
  | { status: "paid"; amountUsd: number }
  | { status: "expired" }
  | { status: "invalid" };

interface Checkout {
  linkId: string;
  processId: string;
  bancardUrl: string;
}

// After the iframe reports completion we poll the link the charge created. The
// Bancard confirmation webhook is the source of truth: an approved charge flips
// the link to `paid`, a denied card leaves it `active` and we tell the payer to
// try another card.
const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 8;

const OPEN_CONCEPT = "Pago a Park Lofts";

const PayPage = () => {
  useNoIndex();
  const { amount: param } = useParams<{ amount: string }>();
  const [searchParams] = useSearchParams();
  const source = useMemo(() => resolveSource(param), [param]);

  const [view, setView] = useState<View>({ status: "loading" });
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

  // Resolve what the page shows. Open amounts render immediately and fetch the
  // PYG preview; links fetch their fixed amount, concept and current status.
  useEffect(() => {
    let active = true;

    if (source.kind === "invalid") {
      setView({ status: "invalid" });
      return;
    }

    if (source.kind === "amount") {
      setView({
        status: "ready",
        amountUsd: source.amountUsd,
        amountPyg: null,
        concept: OPEN_CONCEPT,
      });
      getFxRate()
        .then((rate) => {
          if (active) {
            setView((prev) =>
              prev.status === "ready"
                ? { ...prev, amountPyg: Math.round(source.amountUsd * rate.effective_rate) }
                : prev,
            );
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }

    setView({ status: "loading" });
    getPaymentLink(source.linkId)
      .then((link: PublicPaymentLink) => {
        if (!active) return;
        if (link.status === "paid") {
          setView({ status: "paid", amountUsd: link.amount_usd });
          return;
        }
        if (link.status === "expired" || link.expired) {
          setView({ status: "expired" });
          return;
        }
        setView({
          status: "ready",
          amountUsd: link.amount_usd,
          amountPyg: link.amount_pyg,
          concept: link.concept,
        });
      })
      .catch(() => {
        if (active) setView({ status: "invalid" });
      });

    return () => {
      active = false;
    };
  }, [source]);

  const handleStart = async () => {
    if (starting || source.kind === "invalid") return;
    setStarting(true);
    try {
      const result =
        source.kind === "link"
          ? { ...(await startLinkPayment(source.linkId)), link_id: source.linkId }
          : await startOpenPayment(source.amountUsd);
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

  const verifyCharge = useCallback(async (linkId: string) => {
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
  }, []);

  // Bancard does a full top-level redirect to the return_url on 3DS, escaping
  // the iframe. When the result page renders INSIDE the checkout iframe instead,
  // it bridges the outcome to the parent. That bridge lives on the result page
  // now, not here, so /pay never tries to interpret a Bancard status param.
  const status = searchParams.get("status");
  useEffect(() => {
    if (!status) return;
    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: "bancard_payment_complete",
          status: status === "cancelled" ? "cancelled" : "success",
        },
        "*",
      );
    }
  }, [status]);

  return (
    <section className="pl-container py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        {verifying || view.status === "loading" ? <PaySkeleton /> : null}

        {!verifying && view.status === "ready" ? (
          <ReadyView
            concept={view.concept}
            amountUsd={view.amountUsd}
            amountPyg={view.amountPyg}
            onPay={handleStart}
            starting={starting}
          />
        ) : null}

        {!verifying && view.status === "paid" ? <PaidView amountUsd={view.amountUsd} /> : null}

        {!verifying && view.status === "expired" ? (
          <NoticeView
            title="Este enlace ya expiró"
            body="El enlace de pago venció. Contactanos para que te enviemos uno nuevo."
          />
        ) : null}

        {!verifying && view.status === "invalid" ? (
          <NoticeView
            title="Monto de pago inválido"
            body="El enlace no es válido. Usá un enlace con el formato /pay/300 o el enlace que te enviamos, o contactanos para que te demos el correcto."
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
  concept,
  amountUsd,
  amountPyg,
  onPay,
  starting,
}: {
  concept: string;
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
        <p className="mt-3 text-lg font-medium text-charcoal">{concept}</p>

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
        <Link to="/" className="pl-btn-primary">
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
