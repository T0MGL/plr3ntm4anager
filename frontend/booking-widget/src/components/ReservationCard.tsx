import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { IoChevronUp, IoChevronDown, IoRemove, IoAdd, IoCloseOutline } from "react-icons/io5";
import { useTranslation } from "react-i18next";
import DatePicker from "./DatePicker";
import { type DateRange } from "react-day-picker";

type GuestState = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

interface ReservationCardProps {
  unitId: string;
  nightlyRateUsd: number;
  maxGuests: number;
  range?: DateRange;
  onSelectRange: (range: DateRange | undefined) => void;
  totalGuests: number;
  guestState: GuestState;
  onUpdateGuests: (newState: GuestState) => void;
  onReserve: (data: {
    selectedDates: { checkIn: string; checkOut: string };
    guestCount: number;
    nights: number;
    totalPrice: number;
  }) => void;
}

type GuestKey = keyof GuestState;

type CounterRowProps = {
  title: string;
  sub: string;
  val: number;
  keyName: GuestKey;
  min: number;
  max: number;
  onUpdate: (key: GuestKey, delta: number, min: number, max: number) => void;
  guestState: GuestState;
  maxGuests: number;
};

function CounterRow({
  title,
  sub,
  val,
  keyName,
  min,
  max,
  onUpdate,
  guestState,
  maxGuests,
}: CounterRowProps) {
  const reachedMax =
    val >= max ||
    (keyName !== "infants" &&
      keyName !== "pets" &&
      guestState.adults + guestState.children >= maxGuests);

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div>
        <div className="font-bold text-[15px]">{title}</div>
        <div className="text-xs text-gray-500">{sub}</div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => onUpdate(keyName, -1, min, max)}
          disabled={val <= min}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-black disabled:opacity-20 transition-all font-bold"
        >
          <IoRemove />
        </button>
        <span className="w-4 text-center font-medium">{val}</span>
        <button
          onClick={() => onUpdate(keyName, 1, min, max)}
          disabled={reachedMax}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-black disabled:opacity-20 transition-all font-bold"
        >
          <IoAdd />
        </button>
      </div>
    </div>
  );
}

const ReservationCard: React.FC<ReservationCardProps> = ({
  unitId,
  nightlyRateUsd,
  maxGuests,
  range,
  onSelectRange,
  totalGuests,
  guestState,
  onUpdateGuests,
  onReserve,
}) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("es") ? es : enUS;
  const [guestOpen, setGuestOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const guestRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  const nights = useMemo(() => {
    if (!range?.from || !range?.to) return 0;
    return differenceInCalendarDays(range.to, range.from);
  }, [range]);

  const hasValidDates = nights >= 1;
  const totalPrice = hasValidDates ? nightlyRateUsd * nights : 0;

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (guestOpen && !guestRef.current?.contains(event.target as Node)) {
        setGuestOpen(false);
      }
      if (calendarOpen && !calendarRef.current?.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [guestOpen, calendarOpen]);

  const updateCount = (key: GuestKey, delta: number, min: number, max: number) => {
    const currentTotal = guestState.adults + guestState.children;
    if (key === "adults" || key === "children") {
      if (delta > 0 && currentTotal >= maxGuests) return;
    }
    const nextValue = Math.max(min, Math.min(max, guestState[key] + delta));
    onUpdateGuests({ ...guestState, [key]: nextValue });
  };

  const renderDate = (value?: Date) =>
    value ? format(value, "dd MMM yyyy", { locale: dateLocale }) : t("reservationCard.addDate");

  const guestsSummary =
    totalGuests === 1
      ? t("reservationCard.guestSummary", { count: totalGuests })
      : t("reservationCard.guestsSummary", { count: totalGuests });

  const infantsSuffix =
    guestState.infants === 0
      ? ""
      : guestState.infants === 1
        ? t("reservationCard.infantsSuffix", { count: guestState.infants })
        : t("reservationCard.infantsSuffixPlural", { count: guestState.infants });

  const priceLine =
    nights === 1
      ? t("reservationCard.pricePerNight", { price: nightlyRateUsd, nights })
      : t("reservationCard.pricePerNights", { price: nightlyRateUsd, nights });

  const handleReserve = () => {
    if (!hasValidDates || !range?.from || !range?.to) return;
    onReserve({
      selectedDates: {
        checkIn: format(range.from, "yyyy-MM-dd"),
        checkOut: format(range.to, "yyyy-MM-dd"),
      },
      guestCount: totalGuests + guestState.infants,
      nights,
      totalPrice,
    });
  };

  return (
    <div className="relative group" ref={cardRef}>
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-6 w-full max-w-[420px] mx-auto transition-all duration-300 hover:shadow-2xl">
        <div className="flex justify-between items-end mb-6">
          <div>
            <span className="text-2xl font-bold">${nightlyRateUsd}</span>
            <span className="text-gray-600 ml-1">{t("reservationCard.perNight")}</span>
          </div>
        </div>

        <div className="border border-gray-400 rounded-xl overflow-hidden mb-4 bg-white relative">
          <div className="grid grid-cols-2 border-b border-gray-400 relative">
            <button
              onClick={() => {
                setCalendarOpen(true);
                setGuestOpen(false);
              }}
              className={`p-3 text-left border-r border-gray-400 hover:bg-gray-50 transition-colors ${
                calendarOpen ? "bg-gray-100" : ""
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider">
                {t("reservationCard.checkIn")}
              </div>
              <div className="text-sm font-medium">{renderDate(range?.from)}</div>
            </button>
            <button
              onClick={() => {
                setCalendarOpen(true);
                setGuestOpen(false);
              }}
              className={`p-3 text-left hover:bg-gray-50 transition-colors ${
                calendarOpen ? "bg-gray-100" : ""
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider">
                {t("reservationCard.checkOut")}
              </div>
              <div className="text-sm font-medium">{renderDate(range?.to)}</div>
            </button>

            {calendarOpen && (
              <div
                className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setCalendarOpen(false);
                }}
              >
                <div
                  ref={calendarRef}
                  className="bg-white shadow-2xl w-full sm:max-w-[560px] lg:max-w-[860px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-[#222222]">{t("datePicker.selectDates")}</h3>
                    <button
                      onClick={() => setCalendarOpen(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label={t("common.close")}
                    >
                      <IoCloseOutline className="text-2xl" />
                    </button>
                  </div>
                  <DatePicker unitId={unitId} range={range} onSelectRange={onSelectRange} hideHeader />
                  <div className="mt-6 flex justify-between items-center border-t border-gray-100 pt-5">
                    <button
                      onClick={() => onSelectRange(undefined)}
                      className="text-sm font-semibold text-[#222222] underline"
                    >
                      {t("datePicker.clearDates")}
                    </button>
                    <button
                      onClick={() => setCalendarOpen(false)}
                      className="bg-black text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors"
                    >
                      {t("reservationCard.close")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={guestRef}>
            <button
              onClick={() => {
                setGuestOpen(!guestOpen);
                setCalendarOpen(false);
              }}
              className={`w-full p-3 text-left flex justify-between items-center hover:bg-gray-50 transition-colors ${
                guestOpen ? "bg-gray-100" : ""
              }`}
            >
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider">
                  {t("reservationCard.guests")}
                </div>
                <div className="text-sm font-medium">
                  {guestsSummary}
                  {infantsSuffix}
                </div>
              </div>
              {guestOpen ? <IoChevronUp /> : <IoChevronDown />}
            </button>

            {guestOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                <CounterRow
                  title={t("reservationCard.adults")}
                  sub={t("reservationCard.adultsSub")}
                  val={guestState.adults}
                  keyName="adults"
                  min={1}
                  max={maxGuests}
                  onUpdate={updateCount}
                  guestState={guestState}
                  maxGuests={maxGuests}
                />
                <CounterRow
                  title={t("reservationCard.children")}
                  sub={t("reservationCard.childrenSub")}
                  val={guestState.children}
                  keyName="children"
                  min={0}
                  max={maxGuests}
                  onUpdate={updateCount}
                  guestState={guestState}
                  maxGuests={maxGuests}
                />
                <CounterRow
                  title={t("reservationCard.infants")}
                  sub={t("reservationCard.infantsSub")}
                  val={guestState.infants}
                  keyName="infants"
                  min={0}
                  max={5}
                  onUpdate={updateCount}
                  guestState={guestState}
                  maxGuests={maxGuests}
                />
                <CounterRow
                  title={t("reservationCard.pets")}
                  sub={t("reservationCard.petsSub")}
                  val={guestState.pets}
                  keyName="pets"
                  min={0}
                  max={2}
                  onUpdate={updateCount}
                  guestState={guestState}
                  maxGuests={maxGuests}
                />
                <p className="text-[11px] text-gray-500 mt-4 leading-tight opacity-75">
                  {t("reservationCard.maxGuestsNotice", { count: maxGuests })}
                </p>
                <button
                  onClick={() => setGuestOpen(false)}
                  className="w-full mt-4 text-sm font-bold underline text-right hover:opacity-70 transition-opacity"
                >
                  {t("reservationCard.close")}
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleReserve}
          disabled={!hasValidDates}
          className={`w-full py-4 rounded-none font-medium uppercase tracking-[0.18em] text-[11px] transition-all duration-300 active:scale-[0.98] ${
            hasValidDates
              ? "bg-[#1A1A1A] text-white hover:bg-[#C4A96B]"
              : "bg-[#E2DDD4] text-[#A0A0A0] cursor-not-allowed"
          }`}
        >
          {hasValidDates ? t("reservationCard.reserve") : t("reservationCard.checkAvailability")}
        </button>

        {hasValidDates && (
          <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-center text-sm text-gray-400">{t("reservationCard.notCharged")}</p>
            <div className="space-y-4 pt-2">
              <div className="flex justify-between text-[16px] text-gray-600">
                <span className="underline decoration-gray-300 decoration-1 underline-offset-4 cursor-default">
                  {priceLine}
                </span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <div className="pt-6 border-t border-gray-100 flex justify-between font-bold text-[18px] text-[#222222]">
                <span>{t("reservationCard.totalPrice")}</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservationCard;
