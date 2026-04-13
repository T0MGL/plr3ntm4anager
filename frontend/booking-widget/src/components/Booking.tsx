import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose, IoChevronBack, IoPersonOutline, IoMailOutline, IoCallOutline, IoLocationOutline, IoCheckmarkCircle } from "react-icons/io5";
import { FaCreditCard, FaMoneyBillWave } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import LoadingOverlay from "./common/LoadingOverlay";
import CachedImage from "./common/CachedImage";
import BancardCheckout from "./BancardCheckout";
import toast from "react-hot-toast";

interface BookingProps {
  open: boolean;
  onClose: () => void;
  bookingData: {
    listing: {
      id?: string;
      title: string;
      pricePerNight: number;
      image?: string;
    };
    selectedDates: {
      checkIn: string;
      checkOut: string;
    };
    guestCount: number;
  } | null;
}

const Booking = ({ open, onClose, bookingData }: BookingProps) => {
  if (!open || !bookingData) return null;

  const { t, i18n } = useTranslation();
  const [activeStep, setActiveStep] = useState(1);
  const [paymentOption, setPaymentOption] = useState<"full" | "part">("full");
  const [paymentMethod, setPaymentMethod] = useState<"bancard" | "cash">("bancard");

  // User details
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  // Editable details
  const [dates, setDates] = useState({
    checkIn: bookingData.selectedDates.checkIn,
    checkOut: bookingData.selectedDates.checkOut,
  });
  const [guests, setGuests] = useState(bookingData.guestCount);
  const [editDatesOpen, setEditDatesOpen] = useState(false);
  const [editGuestsOpen, setEditGuestsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bancardCheckout, setBancardCheckout] = useState<{
    processId: string;
    bancardUrl: string;
  } | null>(null);

  const computeNights = (ci: string, co: string) => {
    if (!ci || !co) return 0;
    const d1 = new Date(ci);
    const d2 = new Date(co);
    const diffMs = d2.getTime() - d1.getTime();
    if (diffMs <= 0) return 0;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const totalNights = useMemo(() => computeNights(dates.checkIn, dates.checkOut), [dates]);
  const totalPrice = (bookingData.listing.pricePerNight || 0) * totalNights;

  const isInfoValid = userInfo.name.length > 2 && userInfo.email.includes("@") && userInfo.phone.length > 5;

  const handleCreateOrder = async () => {
    if (!isInfoValid) {
      toast.error(t("booking.step1.invalidInfo"));
      setActiveStep(1);
      return;
    }

    setIsLoading(true);
    try {
      const bookingPayload = {
        unit_id: bookingData.listing.id,
        guest_name: userInfo.name,
        guest_email: userInfo.email,
        guest_phone: userInfo.phone,
        guest_address: userInfo.address,
        check_in_date: dates.checkIn,
        check_out_date: dates.checkOut,
        special_requests: "",
        locale: i18n.language,
      };

      const bookingRes = await api.post("/booking-request", bookingPayload);
      const bookingId = bookingRes.data.booking_id;

      if (paymentMethod === "cash") {
        toast.success(t("booking.errors.cashConfirmed"));
        onClose();
        return;
      }

      const paymentRes = await api.post("/payments/preauth", {
        booking_id: bookingId,
      });

      const { process_id, bancard_url } = paymentRes.data;
      if (process_id) {
        setBancardCheckout({
          processId: process_id,
          bancardUrl: bancard_url,
        });
      } else {
        throw new Error(t("booking.errors.missingProcessId"));
      }
    } catch (err: unknown) {
      console.error("Booking error:", err);
      const fallback = t("booking.errors.createFailed");
      const message =
        err && typeof err === "object" && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ??
            fallback)
          : fallback;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/20 focus:border-[#1A1A1A] outline-none transition-all text-[15px]";

  return (
    <>
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 sm:p-6 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[1150px] h-[100dvh] sm:h-[92vh] overflow-hidden bg-white sm:rounded-[2rem] shadow-2xl flex flex-col font-sans text-[#222222]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-gray-100 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <button
                onClick={onClose}
                className="p-2 sm:p-2.5 hover:bg-gray-100 rounded-full transition-all active:scale-95 shrink-0"
                aria-label={t("common.close")}
              >
                <IoClose className="text-xl sm:text-2xl" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight truncate">{t("booking.title")}</h2>
                <p className="text-xs sm:text-sm text-gray-500 font-medium hidden sm:block">{t("booking.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`h-1.5 w-5 sm:w-8 rounded-full transition-all duration-300 ${s <= activeStep ? "bg-[#1A1A1A]" : "bg-gray-100"}`} />
                ))}
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
                {t("booking.stepIndicator", { current: activeStep, total: 4 })}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 p-4 sm:p-8 lg:p-12">

              {/* Left Column: Flow */}
              <div className="lg:col-span-12 xl:col-span-7 space-y-8">

                {/* Step 1: Personal Information */}
                <section className={`transition-all duration-300 ${activeStep === 1 ? "opacity-100 transform-none" : "opacity-60 scale-[0.98] pointer-events-none"}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${activeStep >= 1 ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-400"}`}>
                      {activeStep > 1 ? <IoCheckmarkCircle className="text-2xl" /> : "1"}
                    </div>
                    <h3 className="text-xl font-bold">{t("booking.step1.title")}</h3>
                  </div>

                  {activeStep === 1 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 bg-gray-50/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100"
                    >
                      <div className="relative">
                        <IoPersonOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="text"
                          placeholder={t("booking.step1.fullName")}
                          value={userInfo.name}
                          onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="relative">
                        <IoMailOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="email"
                          placeholder={t("booking.step1.email")}
                          value={userInfo.email}
                          onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="relative">
                        <IoCallOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="tel"
                          placeholder={t("booking.step1.phone")}
                          value={userInfo.phone}
                          onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="relative">
                        <IoLocationOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="text"
                          placeholder={t("booking.step1.address")}
                          value={userInfo.address}
                          onChange={(e) => setUserInfo({ ...userInfo, address: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end mt-2">
                        <button
                          onClick={() =>
                            isInfoValid ? setActiveStep(2) : toast.error(t("booking.step1.missingField"))
                          }
                          className={`bg-[#1A1A1A] text-white px-10 py-3.5 rounded-2xl font-bold transition-all shadow-lg hover:brightness-110 active:scale-95 ${!isInfoValid && "opacity-50 cursor-not-allowed"}`}
                        >
                          {t("booking.step1.continue")}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 ml-12">
                      <p className="text-sm font-medium text-gray-600">
                        {userInfo.name || t("booking.step1.summaryFallback")} · {userInfo.email || t("booking.step1.summaryFallback")}
                      </p>
                      <button
                        onClick={() => setActiveStep(1)}
                        className="text-xs font-bold underline text-[#1A1A1A]"
                      >
                        {t("booking.step1.change")}
                      </button>
                    </div>
                  )}
                </section>

                {/* Step 2: When to pay */}
                <section className={`transition-all duration-300 ${activeStep === 2 ? "opacity-100 transform-none" : "opacity-60 scale-[0.98] pointer-events-none"}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${activeStep >= 2 ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-400"}`}>
                      {activeStep > 2 ? <IoCheckmarkCircle className="text-2xl" /> : "2"}
                    </div>
                    <h3 className="text-xl font-bold">{t("booking.step2.title")}</h3>
                  </div>

                  {activeStep === 2 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 ml-12">
                      <div
                        onClick={() => setPaymentOption("full")}
                        className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 ${paymentOption === "full" ? "border-[#1A1A1A] bg-[#F6F2EC] shadow-md" : "border-gray-100 bg-white hover:border-gray-200"}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-[16px]">
                              {t("booking.step2.payFull", { price: totalPrice.toFixed(2) })}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{t("booking.step2.payFullDesc")}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentOption === "full" ? "border-[#1A1A1A]" : "border-gray-300"}`}>
                            {paymentOption === "full" && <div className="w-3 h-3 bg-[#1A1A1A] rounded-full" />}
                          </div>
                        </div>
                      </div>
                      <div
                        onClick={() => setPaymentOption("part")}
                        className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 ${paymentOption === "part" ? "border-[#1A1A1A] bg-[#F6F2EC] shadow-md" : "border-gray-100 bg-white hover:border-gray-200"}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-[16px]">{t("booking.step2.payPart")}</p>
                            <p className="text-sm text-gray-500 mt-1">{t("booking.step2.payPartDesc")}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentOption === "part" ? "border-[#1A1A1A]" : "border-gray-300"}`}>
                            {paymentOption === "part" && <div className="w-3 h-3 bg-[#1A1A1A] rounded-full" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-4">
                        <button onClick={() => setActiveStep(1)} className="flex items-center gap-1 font-bold text-gray-500 hover:text-black transition-colors">
                          <IoChevronBack /> {t("booking.step2.back")}
                        </button>
                        <button
                          onClick={() => setActiveStep(3)}
                          className="bg-[#1A1A1A] text-white px-10 py-3.5 rounded-2xl font-bold shadow-lg hover:brightness-110 active:scale-95"
                        >
                          {t("booking.step2.continue")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </section>

                {/* Step 3: Payment Method */}
                <section className={`transition-all duration-300 ${activeStep === 3 ? "opacity-100 transform-none" : "opacity-60 scale-[0.98] pointer-events-none"}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${activeStep >= 3 ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-400"}`}>
                      {activeStep > 3 ? <IoCheckmarkCircle className="text-2xl" /> : "3"}
                    </div>
                    <h3 className="text-xl font-bold">{t("booking.step3.title")}</h3>
                  </div>

                  {activeStep === 3 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 ml-12">
                      {/* Bancard */}
                      <div
                        onClick={() => setPaymentMethod("bancard")}
                        className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 ${paymentMethod === "bancard" ? "border-[#1A1A1A] bg-[#F6F2EC] shadow-md" : "border-gray-100 bg-white hover:border-gray-200"}`}
                      >
                        <div className="flex items-center gap-5">
                          <div className={`p-3 rounded-xl ${paymentMethod === "bancard" ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-500"}`}>
                            <FaCreditCard className="text-xl" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-[16px]">{t("booking.step3.bancard")}</p>
                            <p className="text-sm text-gray-500">{t("booking.step3.bancardDesc")}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === "bancard" ? "border-[#1A1A1A]" : "border-gray-300"}`}>
                            {paymentMethod === "bancard" && <div className="w-3 h-3 bg-[#1A1A1A] rounded-full" />}
                          </div>
                        </div>
                      </div>

                      {/* Cash */}
                      <div
                        onClick={() => setPaymentMethod("cash")}
                        className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 ${paymentMethod === "cash" ? "border-[#1A1A1A] bg-[#F6F2EC] shadow-md" : "border-gray-100 bg-white hover:border-gray-200"}`}
                      >
                        <div className="flex items-center gap-5">
                          <div className={`p-3 rounded-xl ${paymentMethod === "cash" ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-500"}`}>
                            <FaMoneyBillWave className="text-xl" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-[16px]">{t("booking.step3.cash")}</p>
                            <p className="text-sm text-gray-500">{t("booking.step3.cashDesc")}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === "cash" ? "border-[#1A1A1A]" : "border-gray-300"}`}>
                            {paymentMethod === "cash" && <div className="w-3 h-3 bg-[#1A1A1A] rounded-full" />}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4">
                        <button onClick={() => setActiveStep(2)} className="flex items-center gap-1 font-bold text-gray-500 hover:text-black transition-colors">
                          <IoChevronBack /> {t("booking.step3.back")}
                        </button>
                        <button
                          onClick={() => setActiveStep(4)}
                          className="bg-[#1A1A1A] text-white px-10 py-3.5 rounded-2xl font-bold shadow-lg hover:brightness-110 active:scale-95"
                        >
                          {t("booking.step3.review")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </section>

                {/* Step 4: Review */}
                <section className={`transition-all duration-300 ${activeStep === 4 ? "opacity-100 transform-none" : "opacity-60 scale-[0.98] pointer-events-none"}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${activeStep >= 4 ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-400"}`}>
                      4
                    </div>
                    <h3 className="text-xl font-bold">{t("booking.step4.title")}</h3>
                  </div>

                  {activeStep === 4 && (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="ml-12">
                      <div className="bg-[#F6F2EC] p-6 rounded-3xl border border-[#1A1A1A]/10 mb-8">
                        <h4 className="font-bold mb-4">{t("booking.step4.summaryHeading")}</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t("booking.step4.guestLabel")}</span>
                            <span className="font-bold">{userInfo.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t("booking.step4.paymentLabel")}</span>
                            <span className="font-bold uppercase">{paymentMethod} ({paymentOption})</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[14px] leading-relaxed text-[#717171] mb-8">
                        {t("booking.step4.legal", {
                          rules: t("booking.step4.houseRules"),
                          safety: t("booking.step4.safetyDisclosures"),
                          cancellation: t("booking.step4.cancellationPolicy"),
                        })}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={() => setActiveStep(3)} className="px-6 py-3 rounded-2xl font-bold border border-gray-200 hover:bg-gray-50 transition-colors text-[15px]">
                          {t("booking.step4.back")}
                        </button>
                        <button
                          onClick={handleCreateOrder}
                          className="flex-1 bg-[#1A1A1A] text-white py-3 rounded-2xl font-bold text-[16px] hover:brightness-110 transition-all shadow-xl active:scale-[0.98]"
                        >
                          {t("booking.step4.confirm")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </section>

              </div>

              {/* Right Column: Summary Card */}
              <div className="lg:col-span-12 xl:col-span-5">
                <div className="sticky top-10 bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 space-y-8">
                  {/* Property Brief */}
                  <div className="flex gap-5">
                    <div className="relative group">
                      <CachedImage
                        src={bookingData.listing.image}
                        className="w-28 h-28 object-cover rounded-2xl shadow-md transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-[17px] leading-tight mb-2 line-clamp-2">{bookingData.listing.title}</h4>
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gray-400">
                        {t("booking.summary.brand")}
                      </p>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="border-t border-gray-50 pt-8 space-y-6">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-[#1A1A1A] rounded-full" />
                      {t("booking.summary.yourTrip")}
                    </h4>

                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="mt-1 p-2 bg-gray-50 rounded-lg"><IoLocationOutline className="text-gray-400" /></div>
                        <div>
                          <p className="font-bold text-[15px]">{t("booking.summary.dates")}</p>
                          <p className="text-[14px] text-gray-500 font-medium">{dates.checkIn} – {dates.checkOut}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditDatesOpen(!editDatesOpen)}
                        className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] hover:opacity-70 transition-opacity mt-1"
                      >
                        {editDatesOpen ? t("booking.summary.closeEdit") : t("booking.summary.edit")}
                      </button>
                    </div>
                    {editDatesOpen && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{t("reservationCard.checkIn")}</label>
                          <input
                            type="date"
                            value={dates.checkIn}
                            onChange={(e) => setDates({ ...dates, checkIn: e.target.value })}
                            className="w-full p-2 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 ring-[#1A1A1A]/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{t("reservationCard.checkOut")}</label>
                          <input
                            type="date"
                            value={dates.checkOut}
                            onChange={(e) => setDates({ ...dates, checkOut: e.target.value })}
                            className="w-full p-2 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 ring-[#1A1A1A]/20"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="mt-1 p-2 bg-gray-50 rounded-lg"><IoPersonOutline className="text-gray-400" /></div>
                        <div>
                          <p className="font-bold text-[15px]">{t("booking.summary.guests")}</p>
                          <p className="text-[14px] text-gray-500 font-medium">
                            {t(guests === 1 ? "booking.summary.guest" : "booking.summary.guestsPlural", { count: guests })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditGuestsOpen(!editGuestsOpen)}
                        className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] hover:opacity-70 transition-opacity mt-1"
                      >
                        {editGuestsOpen ? t("booking.summary.closeEdit") : t("booking.summary.edit")}
                      </button>
                    </div>
                    {editGuestsOpen && (
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <span className="text-sm font-medium text-gray-600">{t("booking.summary.totalGuests")}</span>
                        <div className="flex items-center gap-5">
                          <button
                            onClick={() => setGuests(Math.max(1, guests - 1))}
                            className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors"
                            aria-label={t("filterBar.guestsModal.decreaseLabel")}
                          >
                            -
                          </button>
                          <span className="font-bold text-lg w-4 text-center">{guests}</span>
                          <button
                            onClick={() => setGuests(guests + 1)}
                            className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors"
                            aria-label={t("filterBar.guestsModal.increaseLabel")}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="border-t border-gray-50 pt-8">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-[#1A1A1A] rounded-full" />
                      {t("booking.summary.priceDetails")}
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[#222222]">
                        <span className="text-[15px] font-medium underline underline-offset-4 decoration-gray-200">
                          {t("booking.summary.pricePerNights", {
                            price: bookingData.listing.pricePerNight,
                            nights: totalNights,
                          })}
                        </span>
                        <span className="text-[15px] font-bold">${totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-100">
                      <span className="font-bold text-[19px]">{t("booking.summary.totalUsd")}</span>
                      <span className="font-bold text-[19px] underline underline-offset-4 decoration-[#1A1A1A] decoration-2">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>


                </div>
              </div>

            </div>
          </div>

          <LoadingOverlay show={isLoading} message={t("booking.loading")} />
        </motion.div>
      </div>
    </AnimatePresence>

    {bancardCheckout && (
      <BancardCheckout
        processId={bancardCheckout.processId}
        bancardUrl={bancardCheckout.bancardUrl}
        onClose={() => setBancardCheckout(null)}
      />
    )}
    </>
  );
};

export default Booking;
