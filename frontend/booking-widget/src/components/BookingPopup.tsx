
import React, { useEffect, useMemo, useState } from "react";

export type BookingPayload = {
  listing: {
    id?: string;
    title: string;
    rating?: number;
    reviewsCount?: number;
    pricePerNight: number;
    image?: string;
  };
  selectedDates: {
    checkIn: string;
    checkOut: string;
  };
  guestCount: number;
};

type BookingPopupProps = {
  open: boolean;
  bookingData: BookingPayload | null;
  onClose: () => void;
};

const getNights = (checkIn: string, checkOut: string): number => {
  const from = new Date(`${checkIn}T00:00:00`);
  const to = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const diff = to.getTime() - from.getTime();
  if (diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

const BookingPopup: React.FC<BookingPopupProps> = ({ open, bookingData, onClose }) => {
  const [step, setStep] = useState(1);
  const [paymentOption, setPaymentOption] = useState<"full" | "part">("full");
  const [paymentMethod, setPaymentMethod] = useState<"bancard" | "cash">("bancard");
  const [checkIn, setCheckIn] = useState(bookingData?.selectedDates.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(bookingData?.selectedDates.checkOut ?? "");
  const [guests, setGuests] = useState(bookingData?.guestCount ?? 1);

  useEffect(() => {
    if (!open || !bookingData) return;
    setStep(1);
    setPaymentOption("full");
    setPaymentMethod("bancard");
    setCheckIn(bookingData.selectedDates.checkIn);
    setCheckOut(bookingData.selectedDates.checkOut);
    setGuests(bookingData.guestCount);
  }, [open, bookingData]);

  const nights = useMemo(() => getNights(checkIn, checkOut), [checkIn, checkOut]);
  const totalPrice = useMemo(() => {
    if (!bookingData) return 0;
    return Number(bookingData.listing.pricePerNight || 0) * nights;
  }, [bookingData, nights]);

  if (!open || !bookingData) return null;

  const canProceed = nights > 0 && guests > 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/55 p-4 sm:p-6">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-7">
          <h2 className="text-xl font-semibold text-[#222222]">Confirm and pay</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100"
          >
            Exit
          </button>
        </div>

        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-2xl border border-neutral-200 p-5">
              <h3 className="text-lg font-semibold">1. Choose when to pay</h3>
              <div className="mt-4 space-y-3">
                <button type="button" onClick={() => setPaymentOption("full")} className={`w-full rounded-xl border p-4 text-left ${paymentOption === "full" ? "border-[#A36D3A] bg-[#fdfaf7]" : "border-neutral-200"}`}>
                  <p className="font-semibold">Pay ${totalPrice.toFixed(2)} now</p>
                  <p className="text-sm text-neutral-500">Pay the total to finalize your reservation.</p>
                </button>
                <button type="button" onClick={() => setPaymentOption("part")} className={`w-full rounded-xl border p-4 text-left ${paymentOption === "part" ? "border-[#A36D3A] bg-[#fdfaf7]" : "border-neutral-200"}`}>
                  <p className="font-semibold">Pay part now, part later</p>
                  <p className="text-sm text-neutral-500">Split payment into two charges.</p>
                </button>
              </div>
              <div className="mt-4 text-right">
                <button type="button" disabled={!canProceed} onClick={() => setStep(2)} className="rounded-xl bg-[#A36D3A] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              </div>
            </section>

            <section className={`rounded-2xl border border-neutral-200 p-5 ${step < 2 ? "opacity-70" : ""}`}>
              <h3 className="text-lg font-semibold">2. Add a payment method</h3>
              <div className="mt-4 space-y-3">
                <button type="button" onClick={() => setPaymentMethod("bancard")} className={`w-full rounded-xl border p-4 text-left ${paymentMethod === "bancard" ? "border-[#A36D3A] bg-[#fdfaf7]" : "border-neutral-200"}`}>
                  <p className="font-semibold">Bancard</p>
                  <p className="text-sm text-neutral-500">Pay securely using Bancard.</p>
                </button>
                <button type="button" onClick={() => setPaymentMethod("cash")} className={`w-full rounded-xl border p-4 text-left ${paymentMethod === "cash" ? "border-[#A36D3A] bg-[#fdfaf7]" : "border-neutral-200"}`}>
                  <p className="font-semibold">Cash</p>
                  <p className="text-sm text-neutral-500">Pay in person at check-in.</p>
                </button>
              </div>
                <button type="button" disabled={!canProceed} onClick={() => setStep(3)} className="rounded-xl bg-[#A36D3A] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              <div className="mt-4 text-right">
              </div>
            </section>

            <section className={`rounded-2xl border border-neutral-200 p-5 ${step < 3 ? "opacity-70" : ""}`}>
              <h3 className="text-lg font-semibold">3. Review your request</h3>
              <p className="mt-3 text-sm text-neutral-600">By confirming, you agree to house rules, safety disclosures, cancellation policy, and guest refund policy.</p>
              <button type="button" disabled={!canProceed} className="mt-5 w-full rounded-xl bg-[#A36D3A] px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Confirm and Pay</button>
            </section>
          </div>

          <aside className="lg:col-span-5">
            <div className="rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex gap-4">
                <img src={bookingData.listing.image || "https://picsum.photos/200/150"} alt={bookingData.listing.title} className="h-24 w-28 rounded-xl object-cover" />
                <div>
                  <p className="text-sm text-neutral-500">Unit</p>
                  <h4 className="font-semibold">{bookingData.listing.title}</h4>
                  <p className="mt-1 text-sm text-neutral-600">{bookingData.listing.rating ?? 0} ({bookingData.listing.reviewsCount ?? 0} reviews)</p>
                </div>
              </div>

              <div className="mt-5 space-y-4 border-t border-neutral-200 pt-4 text-sm">
                <label className="block"><span className="text-neutral-500">Check-in</span><input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" /></label>
                <label className="block"><span className="text-neutral-500">Checkout</span><input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" /></label>
                <label className="block"><span className="text-neutral-500">Guests</span><input type="number" min={1} value={guests} onChange={(event) => setGuests(Math.max(1, Number(event.target.value || 1)))} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" /></label>
              </div>

              <div className="mt-5 border-t border-neutral-200 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>${bookingData.listing.pricePerNight} x {nights} night{nights === 1 ? "" : "s"}</span>
                  <span className="font-semibold">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default BookingPopup;
