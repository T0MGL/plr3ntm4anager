import React, { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";

declare global {
  interface Window {
    Bancard?: {
      Checkout: {
        createForm: (
          containerId: string,
          processId: string,
          options?: Record<string, unknown>
        ) => void;
      };
    };
  }
}

interface BancardCheckoutProps {
  processId: string;
  bancardUrl: string;
  onClose: () => void;
}

const BancardCheckout: React.FC<BancardCheckoutProps> = ({
  processId,
  bancardUrl,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentResult, setPaymentResult] = useState<"success" | "cancelled" | null>(null);

  const isStub = processId.startsWith("stub_");

  // Listen for postMessage from the iframe (payment result/cancelled pages)
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === "bancard_payment_complete") {
        if (event.data.status === "success") {
          setPaymentResult("success");
        } else {
          setPaymentResult("cancelled");
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Handle payment result state
  useEffect(() => {
    if (paymentResult === "success") {
      toast.success("Payment completed successfully!");
      const timer = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(timer);
    }
  }, [paymentResult, onClose]);

  // Stub mode: simulate payment without loading Bancard JS
  useEffect(() => {
    if (!isStub) return;
    setLoading(false);
  }, [isStub]);

  // Live mode: load Bancard checkout JS and create form
  useEffect(() => {
    if (isStub) return;

    const scriptId = "bancard-checkout-js";

    // Don't load if already present
    if (document.getElementById(scriptId)) {
      initCheckout();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${bancardUrl}/checkout/javascript/dist/bancard-checkout-4.0.0.js`;
    script.async = true;

    script.onload = () => {
      initCheckout();
    };

    script.onerror = () => {
      setLoading(false);
      setError("Failed to load payment form. Please try again.");
    };

    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.remove();
      }
    };
  }, [processId, bancardUrl, isStub]);

  function initCheckout() {
    setLoading(false);

    if (!window.Bancard) {
      setError("Payment system unavailable. Please try again.");
      return;
    }

    try {
      window.Bancard.Checkout.createForm("bancard-checkout-container", processId, {
        styles: {
          "form-background-color": "#FFFFFF",
          "button-background-color": "#A36D3A",
          "button-text-color": "#FFFFFF",
          "button-border-color": "#A36D3A",
          "input-background-color": "#FFFFFF",
          "input-text-color": "#222222",
          "input-border-color": "#D1D5DB",
          "input-placeholder-color": "#9CA3AF",
        },
      });
    } catch (err) {
      console.error("Bancard Checkout init error:", err);
      setError("Failed to initialize payment form.");
    }
  }

  function handleStubPayment() {
    setPaymentResult("success");
  }

  // Success/Cancelled result view
  if (paymentResult) {
    const isSuccess = paymentResult === "success";
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: isSuccess ? "#E8F5E9" : "#FFF3E0" }}
          >
            {isSuccess ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          <h3 className="text-xl font-bold text-[#222]">
            {isSuccess ? "Payment Successful" : "Payment Cancelled"}
          </h3>
          <p className="text-sm text-gray-500 mt-2 mb-6">
            {isSuccess
              ? "Your payment has been processed. Your booking is now pending approval."
              : "The payment was not completed. You can try again."}
          </p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-[#A36D3A] text-white rounded-2xl font-bold hover:brightness-110 transition-all"
          >
            {isSuccess ? "Done" : "Go Back"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[#222222]">Secure Payment</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Checkout container */}
        <div className="p-6 min-h-[400px]">
          {loading && (
            <div className="flex flex-col items-center justify-center h-[300px] gap-3">
              <div className="w-8 h-8 border-3 border-[#A36D3A] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Loading payment form...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-[300px] gap-4 text-center">
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#A36D3A] text-white rounded-xl font-bold hover:brightness-110 transition-all"
              >
                Go Back
              </button>
            </div>
          )}

          {/* Stub mode: simulated payment UI */}
          {isStub && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-[300px] gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A36D3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-[#222] text-lg">Test Mode</p>
                <p className="text-sm text-gray-500 mt-1">Bancard is in stub mode. Click below to simulate a successful payment.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStubPayment}
                  className="px-6 py-2.5 bg-[#A36D3A] text-white rounded-xl font-bold hover:brightness-110 transition-all"
                >
                  Simulate Payment
                </button>
              </div>
            </div>
          )}

          {/* Live mode: Bancard iframe renders here */}
          {!isStub && (
            <div
              id="bancard-checkout-container"
              ref={containerRef}
              className={loading || error ? "hidden" : ""}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default BancardCheckout;
