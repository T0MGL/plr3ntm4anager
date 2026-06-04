import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import {
  getPaymentLink,
  startPaymentLinkCheckout,
  type PublicPaymentLink,
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

type View =
  | { status: "loading" }
  | { status: "ready"; link: PublicPaymentLink }
  | { status: "paid"; link: PublicPaymentLink }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "error"; message: string };

interface Checkout {
  processId: string;
  bancardUrl: string;
}

// Poll the link after the iframe reports completion. The Bancard confirmation
// webhook is the source of truth: an approved charge flips the link to `paid`,
// a denied card (response_code 12 and friends) leaves it `active` for a retry.
const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 8;

const PayPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
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

  const load = useCallback(async () => {
    if (!id) {
      setView({ status: "not_found" });
      return;
    }
    try {
      const link = await getPaymentLink(id);
      if (!mounted.current) return;
      if (link.status === "paid") {
        setView({ status: "paid", link });
      } else if (link.status === "expired" || link.expired) {
        setView({ status: "expired" });
      } else {
        setView({ status: "ready", link });
      }
    } catch (err) {
      if (!mounted.current) return;
      const message = err instanceof Error ? err.message : "No se pudo cargar el pago.";
      if (message.toLowerCase().includes("not found") || message.includes("404")) {
        setView({ status: "not_found" });
      } else {
        setView({ status: "error", message });
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStart = async () => {
    if (!id || starting) return;
    setStarting(true);
    try {
      const result = await startPaymentLinkCheckout(id);
      setCheckout({ processId: result.process_id, bancardUrl: result.bancard_url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar el pago.";
      toast.error(message);
    } finally {
      setStarting(false);
    }
  };

  const handleSuccess = useCallback(async () => {
    setCheckout(null);
    setVerifying(true);

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      try {
        const link = await getPaymentLink(id ?? "");
        if (!mounted.current) return;
        if (link.status === "paid") {
          setVerifying(false);
          setView({ status: "paid", link });
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
      "El pago no pudo procesarse con esta tarjeta. Probá con otra tarjeta o contactanos.",
    );
    void load();
  }, [id, load]);

  // Bancard returns to /pay/:id?status=... When this renders INSIDE the
  // checkout iframe, bridge the result up to the parent window so the open
  // PayCheckout drives the verification, then stop. When it renders at the top
  // level (return_url loaded directly), verify here.
  useEffect(() => {
    const status = searchParams.get("status");
    if (!status) return;

    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "bancard_payment_complete", status: status === "success" ? "success" : "cancelled" },
        "*",
      );
      return;
    }

    if (status === "success") {
      void handleSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="pl-container py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        {view.status === "loading" || verifying ? <PaySkeleton /> : null}

        {view.status === "ready" && !verifying ? (
          <ReadyView
            link={view.link}
            onPay={handleStart}
            starting={starting}
          />
        ) : null}

        {view.status === "paid" && !verifying ? <PaidView link={view.link} /> : null}

        {view.status === "expired" && !verifying ? (
          <NoticeView
            title="Este enlace de pago expiró"
            body="El enlace ya no está disponible. Contactanos para que generemos uno nuevo."
          />
        ) : null}

        {view.status === "not_found" && !verifying ? (
          <NoticeView
            title="Enlace de pago no encontrado"
            body="El enlace no existe o fue revocado. Verificá el link o contactanos."
          />
        ) : null}

        {view.status === "error" && !verifying ? (
          <NoticeView title="Algo salió mal" body={view.message} />
        ) : null}
      </div>

      {checkout ? (
        <PayCheckout
          processId={checkout.processId}
          bancardUrl={checkout.bancardUrl}
          onClose={() => setCheckout(null)}
          onSuccess={handleSuccess}
        />
      ) : null}
    </section>
  );
};

function ReadyView({
  link,
  onPay,
  starting,
}: {
  link: PublicPaymentLink;
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
        <p className="mt-3 text-lg font-medium text-charcoal">{link.concept}</p>

        <div className="mt-10 border-t border-stone pt-8">
          <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
            Total a pagar
          </div>
          <div className="font-display mt-3 flex items-baseline gap-2 text-charcoal">
            <span className="text-5xl leading-none md:text-6xl">{USD.format(link.amount_usd)}</span>
            <span className="text-base text-charcoal-400">USD</span>
          </div>
          <p className="mt-3 text-sm text-charcoal-500">
            Se cobrará {PYG.format(link.amount_pyg)} al tipo de cambio del día.
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

function PaidView({ link }: { link: PublicPaymentLink }) {
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
        Pagaste {USD.format(link.amount_usd)} por {link.concept}. Guardá esta página como
        comprobante.
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
