import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useNoIndex } from "../hooks/useNoIndex";

const PaymentCancelledPage = () => {
  useNoIndex();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");

  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "bancard_payment_complete", status: "cancelled", bookingId },
        "*",
      );
    }
  }, [bookingId]);

  return (
    <section className="pl-container flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center border border-gold/60 bg-cream-50"
        aria-hidden
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gold"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <h2 className="mt-8 font-display text-3xl leading-tight text-charcoal md:text-4xl">
        {t("payment.cancelledTitle")}
      </h2>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-charcoal-500">
        {t("payment.cancelledBody")}
      </p>
    </section>
  );
};

export default PaymentCancelledPage;
