import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose, IoChevronBack, IoStar, IoPersonOutline, IoMailOutline, IoCallOutline, IoLocationOutline, IoCheckmarkCircle } from "react-icons/io5";
import { FaCreditCard, FaMoneyBillWave } from "react-icons/fa";
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
  } | null;
}

const Booking = ({ open, onClose, bookingData }: BookingProps) => {
  if (!open || !bookingData) return null;

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
      toast.error("Please fill in your details correctly");
      setActiveStep(1);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create Booking Request
      const bookingPayload = {
        unit_id: bookingData.listing.id,
        guest_name: userInfo.name,
        guest_email: userInfo.email,
        guest_phone: userInfo.phone,
        guest_address: userInfo.address,
        check_in_date: dates.checkIn,
        check_out_date: dates.checkOut,
        special_requests: "",
      };

      const bookingRes = await api.post("/booking-request", bookingPayload);
      const bookingId = bookingRes.data.booking_id;

      if (paymentMethod === "cash") {
        toast.success("Booking request sent! You can pay in cash upon arrival.");
        onClose();
        return;
      }

      // 2. Initiate Bancard Payment
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
        throw new Error("Payment process ID not received");
      }
    } catch (err: any) {
      console.error("Booking error:", err);
      toast.error(err.response?.data?.error || "Failed to process booking. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A1A]/20 focus:border-[#1A1A1A] outline-none transition-all text-[15px]";

  return (
    <>
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[1150px] h-[92vh] overflow-hidden bg-white rounded-[2rem] shadow-2xl flex flex-col font-sans text-[#222222]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-5">
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-gray-100 rounded-full transition-all active:scale-95"
              >
                <IoClose className="text-2xl" />
              </button>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Confirm and Pay</h2>
                <p className="text-sm text-gray-500 font-medium">Complete your reservation details</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`h-1.5 w-8 rounded-full transition-all duration-300 ${s <= activeStep ? "bg-[#1A1A1A]" : "bg-gray-100"}`} />
                ))}
              </div>
              <span className="text-sm font-bold text-[#1A1A1A] ml-2">Step {activeStep}/4</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 p-8 lg:p-12">

              {/* Left Column: Flow */}
              <div className="lg:col-span-12 xl:col-span-7 space-y-8">

                {/* Step 1: Personal Information */}
                <section className={`transition-all duration-300 ${activeStep === 1 ? "opacity-100 transform-none" : "opacity-60 scale-[0.98] pointer-events-none"}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${activeStep >= 1 ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-400"}`}>
                      {activeStep > 1 ? <IoCheckmarkCircle className="text-2xl" /> : "1"}
                    </div>
                    <h3 className="text-xl font-bold">Your Information</h3>
                  </div>

                  {activeStep === 1 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-50/50 p-6 rounded-3xl border border-gray-100"
                    >
                      <div className="relative">
                        <IoPersonOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={userInfo.name}
                          onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="relative">
                        <IoMailOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="email"
                          placeholder="Email Address"
                          value={userInfo.email}
                          onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="relative">
                        <IoCallOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="tel"
                          placeholder="Phone Number"
                          value={userInfo.phone}
                          onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="relative">
                        <IoLocationOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="text"
                          placeholder="Address (Optional)"
                          value={userInfo.address}
                          onChange={(e) => setUserInfo({ ...userInfo, address: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end mt-2">
                        <button
                          onClick={() => isInfoValid ? setActiveStep(2) : toast.error("Please fill required fields")}
                          className={`bg-[#1A1A1A] text-white px-10 py-3.5 rounded-2xl font-bold transition-all shadow-lg hover:brightness-110 active:scale-95 ${!isInfoValid && "opacity-50 cursor-not-allowed"}`}
                        >
                          Continue to Payment
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 ml-12">
                      <p className="text-sm font-medium text-gray-600">{userInfo.name || "None"} · {userInfo.email || "None"}</p>
                      <button onClick={() => setActiveStep(1)} className="text-xs font-bold underline text-[#1A1A1A]">Change</button>
                    </div>
                  )}
                </section>

                {/* Step 2: When to pay */}
                <section className={`transition-all duration-300 ${activeStep === 2 ? "opacity-100 transform-none" : "opacity-60 scale-[0.98] pointer-events-none"}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${activeStep >= 2 ? "bg-[#1A1A1A] text-white" : "bg-gray-100 text-gray-400"}`}>
                      {activeStep > 2 ? <IoCheckmarkCircle className="text-2xl" /> : "2"}
                    </div>
                    <h3 className="text-xl font-bold">Choose when to pay</h3>
                  </div>

                  {activeStep === 2 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 ml-12">
                      <div
                        onClick={() => setPaymentOption("full")}
                        className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300 ${paymentOption === "full" ? "border-[#1A1A1A] bg-[#F6F2EC] shadow-md" : "border-gray-100 bg-white hover:border-gray-200"}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-[16px]">Pay ${totalPrice.toFixed(2)} now</p>
                            <p className="text-sm text-gray-500 mt-1">Pay the total to finalize your reservation instantly.</p>
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
                            <p className="font-bold text-[16px]">Pay part now, part later</p>
                            <p className="text-sm text-gray-500 mt-1">Secure the booking with a small deposit today.</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentOption === "part" ? "border-[#1A1A1A]" : "border-gray-300"}`}>
                            {paymentOption === "part" && <div className="w-3 h-3 bg-[#1A1A1A] rounded-full" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-4">
                        <button onClick={() => setActiveStep(1)} className="flex items-center gap-1 font-bold text-gray-500 hover:text-black transition-colors">
                          <IoChevronBack /> Back
                        </button>
                        <button
                          onClick={() => setActiveStep(3)}
                          className="bg-[#1A1A1A] text-white px-10 py-3.5 rounded-2xl font-bold shadow-lg hover:brightness-110 active:scale-95"
                        >
                          Continue
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
                    <h3 className="text-xl font-bold">Payment Method</h3>
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
                            <p className="font-bold text-[16px]">Bancard</p>
                            <p className="text-sm text-gray-500">Secure credit or debit card payment.</p>
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
                            <p className="font-bold text-[16px]">Cash on Arrival</p>
                            <p className="text-sm text-gray-500">Pay when you check in at the property.</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === "cash" ? "border-[#1A1A1A]" : "border-gray-300"}`}>
                            {paymentMethod === "cash" && <div className="w-3 h-3 bg-[#1A1A1A] rounded-full" />}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4">
                        <button onClick={() => setActiveStep(2)} className="flex items-center gap-1 font-bold text-gray-500 hover:text-black transition-colors">
                          <IoChevronBack /> Back
                        </button>
                        <button
                          onClick={() => setActiveStep(4)}
                          className="bg-[#1A1A1A] text-white px-10 py-3.5 rounded-2xl font-bold shadow-lg hover:brightness-110 active:scale-95"
                        >
                          Review Trip
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
                    <h3 className="text-xl font-bold">Review and confirm</h3>
                  </div>

                  {activeStep === 4 && (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="ml-12">
                      <div className="bg-[#F6F2EC] p-6 rounded-3xl border border-[#1A1A1A]/10 mb-8">
                        <h4 className="font-bold mb-4">Final Summary</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Guest</span>
                            <span className="font-bold">{userInfo.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Payment</span>
                            <span className="font-bold uppercase">{paymentMethod} ({paymentOption})</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[14px] leading-relaxed text-[#717171] mb-8">
                        By selecting the button below, you agree to the <span className="underline font-medium cursor-pointer">House Rules</span>, <span className="underline font-medium cursor-pointer">Safety Disclosures</span>, and <span className="underline font-medium cursor-pointer">Cancellation Policy</span>.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={() => setActiveStep(3)} className="px-6 py-3 rounded-2xl font-bold border border-gray-200 hover:bg-gray-50 transition-colors text-[15px]">
                          Back
                        </button>
                        <button
                          onClick={handleCreateOrder}
                          className="flex-1 bg-[#1A1A1A] text-white py-3 rounded-2xl font-bold text-[16px] hover:brightness-110 transition-all shadow-xl active:scale-[0.98]"
                        >
                          Confirm and Pay
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
                      <div className="flex items-center gap-1.5 text-sm">
                        <IoStar className="text-[#1A1A1A]" />
                        <span className="font-bold">{bookingData.listing.rating ?? 0}</span>
                        <span className="text-gray-400 font-medium">({bookingData.listing.reviewsCount ?? 0} reviews)</span>
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="border-t border-gray-50 pt-8 space-y-6">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-[#1A1A1A] rounded-full" />
                      Your trip
                    </h4>

                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="mt-1 p-2 bg-gray-50 rounded-lg"><IoLocationOutline className="text-gray-400" /></div>
                        <div>
                          <p className="font-bold text-[15px]">Dates</p>
                          <p className="text-[14px] text-gray-500 font-medium">{dates.checkIn} – {dates.checkOut}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditDatesOpen(!editDatesOpen)}
                        className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] hover:opacity-70 transition-opacity mt-1"
                      >
                        {editDatesOpen ? "Close" : "Edit"}
                      </button>
                    </div>
                    {editDatesOpen && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Check-in</label>
                          <input
                            type="date"
                            value={dates.checkIn}
                            onChange={(e) => setDates({ ...dates, checkIn: e.target.value })}
                            className="w-full p-2 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 ring-[#1A1A1A]/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Check-out</label>
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
                          <p className="font-bold text-[15px]">Guests</p>
                          <p className="text-[14px] text-gray-500 font-medium">{guests} {guests === 1 ? "guest" : "guests"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditGuestsOpen(!editGuestsOpen)}
                        className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] hover:opacity-70 transition-opacity mt-1"
                      >
                        {editGuestsOpen ? "Close" : "Edit"}
                      </button>
                    </div>
                    {editGuestsOpen && (
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <span className="text-sm font-medium text-gray-600">Total Guests</span>
                        <div className="flex items-center gap-5">
                          <button
                            onClick={() => setGuests(Math.max(1, guests - 1))}
                            className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors"
                          >
                            -
                          </button>
                          <span className="font-bold text-lg w-4 text-center">{guests}</span>
                          <button
                            onClick={() => setGuests(guests + 1)}
                            className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors"
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
                      Price details
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[#222222]">
                        <span className="text-[15px] font-medium underline underline-offset-4 decoration-gray-200">${bookingData.listing.pricePerNight} x {totalNights} nights</span>
                        <span className="text-[15px] font-bold">${totalPrice.toFixed(2)}</span>
                      </div>
                      {/* <div className="flex justify-between items-center text-[#222222]">
                        <span className="text-[15px] font-medium underline underline-offset-4 decoration-gray-200">Service fee</span>
                        <span className="text-[15px] font-bold">$0.00</span>
                      </div> */}
                    </div>
                    <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-100">
                      <span className="font-bold text-[19px]">Total (USD)</span>
                      <span className="font-bold text-[19px] underline underline-offset-4 decoration-[#1A1A1A] decoration-2">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>


                </div>
              </div>

            </div>
          </div>

          <LoadingOverlay show={isLoading} message="Preparing secure payment..." />
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
