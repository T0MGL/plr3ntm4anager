import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { format, parseISO } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  getPublicBookingDetails,
  type PublicBookingDetails,
} from "../api/bookings";
import { useNoIndex } from "../hooks/useNoIndex";

type FetchState =
  | { status: "loading" }
  | { status: "ready"; booking: PublicBookingDetails }
  | { status: "error"; message: string };

const PaymentResultPage = () => {
  useNoIndex();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");
  const [state, setState] = useState<FetchState>({ status: "loading" });

  // Notify parent window (BancardCheckout overlay) that the payment completed.
  // Kept as a compatibility bridge for the case Bancard renders this page
  // inside the iframe overlay. When the return_url is loaded at the top level,
  // the postMessage is a no-op and this page renders as a standalone receipt.
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "bancard_payment_complete", status: "success", bookingId },
        "*",
      );
    }
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) {
      setState({ status: "error", message: t("payment.errorTitle") });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const booking = await getPublicBookingDetails(bookingId);
        if (!cancelled) {
          setState({ status: "ready", booking });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : t("payment.errorTitle");
          setState({ status: "error", message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, t]);

  if (state.status === "loading") {
    return <ResultSkeleton />;
  }

  if (state.status === "error") {
    return <ResultError message={state.message} />;
  }

  return <ResultSuccess booking={state.booking} />;
};

function ResultSkeleton() {
  return (
    <section className="pl-container py-20 md:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="h-4 w-24 animate-pulse bg-stone" />
        <div className="mt-6 h-14 w-3/4 animate-pulse bg-stone" />
        <div className="mt-4 h-4 w-1/2 animate-pulse bg-stone" />
        <div className="mt-12 h-64 w-full animate-pulse bg-stone-light" />
      </div>
    </section>
  );
}

function ResultError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <section className="pl-container py-20 md:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <span className="pl-gold-rule" />
        <h1 className="font-display mt-6 text-4xl leading-tight text-charcoal md:text-5xl">
          {t("payment.errorTitle")}
        </h1>
        <p className="mt-4 text-sm text-charcoal-500">{message}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/" className="pl-btn-primary">
            {t("payment.back")}
          </Link>
          <Link to="/contacto" className="pl-btn-ghost">
            {t("payment.contact")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function ResultSuccess({ booking }: { booking: PublicBookingDetails }) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("es") ? es : enUS;
  const dateFmt = i18n.language?.startsWith("es") ? "EEEE d 'de' MMMM" : "EEEE, MMMM d";
  const checkIn = format(parseISO(booking.check_in_date), dateFmt, { locale: dateLocale });
  const checkOut = format(parseISO(booking.check_out_date), dateFmt, { locale: dateLocale });
  const year = format(parseISO(booking.check_in_date), "yyyy");
  const reference = booking.id.slice(0, 8).toUpperCase();
  const firstName =
    booking.guest_first_name.charAt(0).toUpperCase() + booking.guest_first_name.slice(1);

  // Three result states:
  // - paid: card captured, booking confirmed. Final state.
  // - preauthorized: card held, admin will review and capture. Temporary state.
  //                  Shown to guests whose booking routed to manual path so the
  //                  on-screen copy matches the "we are verifying" email.
  // - pending: guest has no active payment yet (rare path, usually loading flicker).
  const isPaid = booking.status === "paid" || booking.payment_status === "completed";
  const isHeld = !isPaid && booking.payment_status === "preauthorized";

  const badgeLabel = isPaid
    ? t("payment.confirmedBadge")
    : isHeld
      ? t("payment.heldBadge")
      : t("payment.receivedBadge");

  const headingLine = isHeld ? t("payment.underReview") : t("payment.stayReserved");

  const emailNotice = isHeld
    ? t("payment.emailNoticeHeld")
    : t("payment.emailNotice");

  const amountLabel = isPaid
    ? t("payment.totalPaid")
    : isHeld
      ? t("payment.cardHold")
      : t("payment.totalDue");

  const amountNote = isPaid
    ? t("payment.secureProcessed")
    : isHeld
      ? t("payment.holdNote")
      : t("payment.secureProcessed");

  const statusValue = isPaid
    ? t("payment.confirmed")
    : isHeld
      ? t("payment.underReviewStatus")
      : t("payment.pending");

  return (
    <section className="pl-container py-16 md:py-24 print:py-0">
      <div className="mx-auto max-w-4xl">
        {/* Print-only branded header */}
        <div className="hidden print:block print:mb-8 print:border-b print:border-stone print:pb-6">
          <div className="flex items-center gap-3">
            <img
              src="https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/logo/park-lofts-logogold.png"
              alt=""
              width={32}
              height={32}
              className="shrink-0"
            />
            <span className="font-display text-xl text-charcoal">Park Lofts</span>
            <span className="h-4 w-px bg-charcoal/25" />
            <span className="text-[0.5rem] font-medium uppercase tracking-[0.3em] text-gold">Rent</span>
          </div>
        </div>
        {/* Header */}
        <div className="max-w-2xl">
          <span className="pl-gold-rule" />
          <div className="mt-6 flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.25em] text-gold">
            <CheckIcon className="h-3.5 w-3.5" />
            {badgeLabel}
          </div>
          <h1 className="font-display mt-5 text-4xl leading-[1.05] text-charcoal md:text-[3.5rem]">
            {t("payment.thanks", { name: firstName })}
            <br />
            {headingLine}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-charcoal-500">
            {emailNotice}
          </p>
        </div>

        {/* Reservation card */}
        <div className="mt-14 border border-stone bg-cream-50">
          {booking.unit_image ? (
            <div className="relative aspect-[16/7] w-full overflow-hidden bg-stone">
              <img
                src={booking.unit_image}
                alt={booking.unit_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="grid gap-10 p-8 md:grid-cols-[1.2fr_1fr] md:gap-14 md:p-12">
            <div>
              <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
                {t("payment.reservedLoft")}
              </div>
              <h2 className="font-display mt-3 text-3xl leading-tight text-charcoal md:text-4xl">
                {booking.unit_name}
              </h2>

              <div className="mt-10 grid grid-cols-2 gap-8 border-t border-stone pt-8">
                <DetailBlock label={t("payment.checkIn")} value={capitalize(checkIn)} sublabel={year} />
                <DetailBlock label={t("payment.checkOut")} value={capitalize(checkOut)} sublabel={year} />
                <DetailBlock
                  label={t("payment.nights")}
                  value={String(booking.nights)}
                  sublabel={
                    booking.nights === 1
                      ? t("payment.nightSingular")
                      : t("payment.nightsPlural")
                  }
                />
                <DetailBlock
                  label={t("payment.reference")}
                  value={reference}
                  sublabel={t("payment.saveCode")}
                />
              </div>
            </div>

            <aside className="border-l-0 border-t border-stone pt-8 md:border-l md:border-t-0 md:pl-12 md:pt-0">
              <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
                {amountLabel}
              </div>
              <div className="font-display mt-3 flex items-baseline gap-2 text-charcoal">
                <span className="text-5xl leading-none md:text-6xl">
                  ${booking.total_price_usd.toFixed(0)}
                </span>
                <span className="text-base text-charcoal-400">USD</span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-charcoal-500">
                {amountNote}
              </p>

              <div className="mt-8 space-y-3 text-sm text-charcoal-500">
                <SummaryLine label={t("payment.guest")} value={firstName} />
                <SummaryLine
                  label={t("payment.status")}
                  value={statusValue}
                  accent={isPaid}
                />
              </div>
            </aside>
          </div>
        </div>

        {/* Next steps */}
        <div className="mt-16 grid gap-10 border-t border-stone pt-14 md:grid-cols-3">
          <NextStep
            index="01"
            title={t("payment.nextSteps.01Title")}
            body={t("payment.nextSteps.01Body")}
          />
          <NextStep
            index="02"
            title={t("payment.nextSteps.02Title")}
            body={t("payment.nextSteps.02Body")}
          />
          <NextStep
            index="03"
            title={t("payment.nextSteps.03Title")}
            body={t("payment.nextSteps.03Body")}
          />
        </div>

        {/* CTAs */}
        <div className="mt-14 flex flex-col items-start gap-4 md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="pl-btn-primary flex items-center gap-2"
          >
            <DownloadIcon className="h-4 w-4" />
            {t("payment.download")}
          </button>
          <Link to="/" className="pl-btn-ghost">
            {t("payment.viewOthers")}
          </Link>
          <Link to="/contacto" className="pl-btn-ghost">
            {t("payment.contactTeam")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function DetailBlock({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div>
      <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-charcoal">{value}</div>
      {sublabel ? <div className="mt-1 text-xs text-charcoal-400">{sublabel}</div> : null}
    </div>
  );
}

function SummaryLine({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-light pb-3 last:border-b-0 last:pb-0">
      <span className="text-[0.625rem] uppercase tracking-[0.2em] text-charcoal-400">{label}</span>
      <span className={accent ? "font-medium text-gold" : "font-medium text-charcoal"}>
        {value}
      </span>
    </div>
  );
}

function NextStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-display text-xl text-gold">{index}</div>
      <h3 className="font-display mt-3 text-2xl leading-tight text-charcoal">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-charcoal-500">{body}</p>
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default PaymentResultPage;
