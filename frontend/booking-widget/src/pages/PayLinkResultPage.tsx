import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getPaymentLink } from "../api/payment-links";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Bancard returns the payer here after a Single Buy on an open /pay charge.
// International cards run a full 3DS top-level redirect, so this page must stand
// on its own: it reads the link id from the query (never from the path, which is
// why /pay/:amount could not be the return target) and polls the link status.
// The confirmation webhook is the source of truth; an approved charge flips the
// link to `paid`, a denied card leaves it `active`. The redirect is UX only.
const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 10;

type View =
  | { status: "verifying" }
  | { status: "paid"; amountUsd: number }
  | { status: "cancelled" }
  | { status: "failed" }
  | { status: "missing" };

const PayLinkResultPage = () => {
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get("link");
  const bancardStatus = searchParams.get("status");

  const [view, setView] = useState<View>(() =>
    !linkId
      ? { status: "missing" }
      : bancardStatus === "cancelled"
        ? { status: "cancelled" }
        : { status: "verifying" },
  );
  const mounted = useRef(true);

  // Compatibility bridge: if Bancard renders this page inside the checkout
  // iframe overlay (instead of a top-level redirect), lift the result to the
  // parent so the open PayCheckout modal can drive verification, exactly like
  // the booking PaymentResultPage does.
  useEffect(() => {
    if (window.parent !== window && bancardStatus) {
      window.parent.postMessage(
        {
          type: "bancard_payment_complete",
          status: bancardStatus === "cancelled" ? "cancelled" : "success",
        },
        "*",
      );
    }
  }, [bancardStatus]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const verify = useCallback(async (id: string) => {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      try {
        const link = await getPaymentLink(id);
        if (!mounted.current) return;
        if (link.status === "paid") {
          setView({ status: "paid", amountUsd: link.amount_usd });
          return;
        }
      } catch {
        // transient: keep polling
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (mounted.current) setView({ status: "failed" });
  }, []);

  useEffect(() => {
    if (!linkId || bancardStatus === "cancelled") return;
    void verify(linkId);
  }, [linkId, bancardStatus, verify]);

  return (
    <section className="pl-container py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        {view.status === "verifying" ? <VerifyingView /> : null}
        {view.status === "paid" ? <PaidView amountUsd={view.amountUsd} /> : null}
        {view.status === "cancelled" ? <CancelledView /> : null}
        {view.status === "failed" ? <FailedView /> : null}
        {view.status === "missing" ? <MissingView /> : null}
      </div>
    </section>
  );
};

function VerifyingView() {
  return (
    <div className="text-center">
      <span className="pl-gold-rule" />
      <div className="mt-10 flex flex-col items-center gap-5">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-charcoal border-t-transparent" />
        <h1 className="font-display text-3xl leading-tight text-charcoal md:text-4xl">
          Confirmando tu pago
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-charcoal-500">
          Estamos verificando la transacción con Bancard. Esto toma unos segundos, no cierres
          esta página.
        </p>
      </div>
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

function CancelledView() {
  return (
    <div className="text-center">
      <span className="pl-gold-rule" />
      <h1 className="font-display mt-6 text-4xl leading-tight text-charcoal md:text-5xl">
        El pago no se completó
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-charcoal-500">
        Cancelaste el pago antes de terminar. No se realizó ningún cobro. Podés volver a
        intentarlo cuando quieras.
      </p>
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

function FailedView() {
  return (
    <div className="text-center">
      <span className="pl-gold-rule" />
      <h1 className="font-display mt-6 text-4xl leading-tight text-charcoal md:text-5xl">
        El pago no se completó
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-charcoal-500">
        La tarjeta fue rechazada o el cobro no pudo procesarse. No te preocupes, no se realizó
        ningún cargo. Probá de nuevo con otra tarjeta o contactanos.
      </p>
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

function MissingView() {
  return (
    <div className="text-center">
      <span className="pl-gold-rule" />
      <h1 className="font-display mt-6 text-4xl leading-tight text-charcoal md:text-5xl">
        No encontramos el pago
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-charcoal-500">
        El enlace de resultado está incompleto. Si realizaste un pago y tenés dudas,
        contactanos y lo verificamos por vos.
      </p>
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

export default PayLinkResultPage;
