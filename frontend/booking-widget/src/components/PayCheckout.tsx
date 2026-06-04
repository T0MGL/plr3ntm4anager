import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Bancard?: {
      Checkout: {
        createForm: (
          containerId: string,
          processId: string,
          options?: Record<string, unknown>,
        ) => void;
      };
    };
  }
}

interface PayCheckoutProps {
  processId: string;
  bancardUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Bancard Checkout iframe for standalone payment links. Mirrors the booking
// BancardCheckout iframe loader but without the booking-cancel side effect:
// a payment link has no availability blocks to release and stays reusable on
// failure, so closing the modal is a clean no-op.
const CONTAINER_ID = "bancard-pay-container";

export function PayCheckout({ processId, bancardUrl, onClose, onSuccess }: PayCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // createForm is only ever called once per mount. Without this guard a script
  // already in the DOM plus a re-render could call it twice and Bancard would
  // either throw or stack two iframes.
  const formCreated = useRef(false);

  const isStub = processId.startsWith("stub_");

  // Bancard renders its return_url inside the iframe on completion. We listen
  // for the bridge postMessage that page emits and lift the result up.
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === "bancard_payment_complete") {
        if (event.data.status === "success") {
          onSuccess();
        } else {
          onClose();
        }
      }
    },
    [onSuccess, onClose],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const initCheckout = useCallback(() => {
    if (formCreated.current) return;

    if (!window.Bancard) {
      setLoading(false);
      setError("El sistema de pago no está disponible. Intentá de nuevo.");
      return;
    }

    // The container must already be committed to the DOM before createForm
    // runs: Bancard injects its iframe by element id and silently no-ops if the
    // target is missing. The div is rendered unconditionally (hidden, never
    // unmounted) so this is a safety assertion, not a race we expect to hit.
    if (!document.getElementById(CONTAINER_ID)) {
      setLoading(false);
      setError("No se pudo inicializar el formulario de pago.");
      return;
    }

    try {
      formCreated.current = true;
      window.Bancard.Checkout.createForm(CONTAINER_ID, processId, {
        styles: {
          "form-background-color": "#FFFFFF",
          "button-background-color": "#1A1A1A",
          "button-text-color": "#FFFFFF",
          "button-border-color": "#1A1A1A",
          "input-background-color": "#FFFFFF",
          "input-text-color": "#222222",
          "input-border-color": "#D1D5DB",
          "input-placeholder-color": "#9CA3AF",
        },
      });
      setLoading(false);
    } catch {
      formCreated.current = false;
      setLoading(false);
      setError("No se pudo inicializar el formulario de pago.");
    }
  }, [processId]);

  useEffect(() => {
    if (isStub) {
      setLoading(false);
      return;
    }

    const scriptId = "bancard-checkout-js";

    if (document.getElementById(scriptId)) {
      initCheckout();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${bancardUrl}/checkout/javascript/dist/bancard-checkout-4.0.0.js`;
    script.async = true;
    script.onload = () => initCheckout();
    script.onerror = () => {
      setLoading(false);
      setError("No se pudo cargar el formulario de pago. Intentá de nuevo.");
    };

    document.head.appendChild(script);
    // The script tag is intentionally left in the DOM on unmount: it is shared
    // with the booking BancardCheckout and is a cacheable third-party SDK.
    // Removing it would force a re-download on the next open and could yank the
    // SDK out from under the booking flow if both are used in one session.
  }, [bancardUrl, isStub, initCheckout]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-bold text-[#222222]">Pago seguro</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-[400px] p-6">
          {loading ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#1A1A1A] border-t-transparent" />
              <p className="text-sm font-medium text-gray-500">Cargando el formulario de pago...</p>
            </div>
          ) : null}

          {error ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-4 text-center">
              <p className="font-medium text-red-600">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#1A1A1A] px-6 py-2.5 font-bold text-white transition-all hover:brightness-110"
              >
                Volver
              </button>
            </div>
          ) : null}

          {isStub && !loading && !error ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-5 text-center">
              <p className="text-lg font-bold text-[#222]">Modo de prueba</p>
              <p className="text-sm text-gray-500">
                Bancard está en modo stub. Simulá un pago exitoso para continuar.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-gray-200 px-6 py-2.5 font-bold text-gray-600 transition-all hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onSuccess}
                  className="rounded-xl bg-[#1A1A1A] px-6 py-2.5 font-bold text-white transition-all hover:brightness-110"
                >
                  Simular pago
                </button>
              </div>
            </div>
          ) : null}

          {!isStub ? (
            <div
              id={CONTAINER_ID}
              ref={containerRef}
              className={loading || error ? "hidden" : ""}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
