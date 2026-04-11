import React, { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange, Matcher } from "react-day-picker";
import {
  addDays,
  addMonths,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import toast from "react-hot-toast";
import { getUnitAvailability } from "../api/units";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import "react-day-picker/dist/style.css";
import "./DatePicker.css";

export type ReservePayload = {
  selectedDates: {
    checkIn: string;
    checkOut: string;
  };
  guestCount: number;
  nights: number;
  totalPrice: number | null;
};

type Props = {
  unitId?: string;
  guests?: number;
  nightlyRateUsd?: number;
  onReserve?: (payload: ReservePayload) => void;
};

function useIsLg() {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isLg;
}

interface DatePickerProps extends Props {
  range?: DateRange;
  onSelectRange: (range: DateRange | undefined) => void;
  hideHeader?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({ unitId, range, onSelectRange, hideHeader }) => {
  const isLg = useIsLg();
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addMonths(today, 6), [today]);
  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(() => startOfMonth(maxDate), [maxDate]);

  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [month, setMonth] = useState<Date>(range?.from ? startOfMonth(range.from) : minMonth);

  useEffect(() => {
    if (!unitId) return;
    let isMounted = true;
    const loadAvailability = async () => {
      try {
        setIsLoadingAvailability(true);
        const availability = await getUnitAvailability(unitId, today, addDays(maxDate, 1));
        if (!isMounted) return;
        const nextBlockedDates = availability.blocked_dates
          .map((v) => startOfDay(parseISO(v)))
          .filter((v) => !Number.isNaN(v.getTime()));
        setBlockedDates(nextBlockedDates);
      } catch (err) {
        console.error("Availability error:", err);
      } finally {
        if (isMounted) setIsLoadingAvailability(false);
      }
    };
    loadAvailability();
    return () => { isMounted = false; };
  }, [maxDate, today, unitId]);

  const disabledDays = useMemo<Matcher[]>(() => [{ before: today }, { after: maxDate }, ...blockedDates], [blockedDates, maxDate, today]);

  // react-day-picker lets users span a range across disabled days. Validate the
  // range before committing and reset to the new endpoint if it crosses any
  // blocked date. This matches the Airbnb UX where picking across an
  // unavailable gap starts a new range.
  const handleSelectRange = (newRange: DateRange | undefined) => {
    if (!newRange?.from || !newRange?.to) {
      onSelectRange(newRange);
      return;
    }

    const crossesBlocked = blockedDates.some(
      (d) => isAfter(d, newRange.from!) && isBefore(d, newRange.to!)
    );

    if (crossesBlocked) {
      toast.error("Those dates cross an unavailable range. Pick shorter dates.");
      onSelectRange({ from: newRange.to, to: undefined });
      return;
    }

    onSelectRange(newRange);
  };

  return (
    <div className="w-full bg-white date-picker-container">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-8 px-2">
          <div>
            <h2 className="text-2xl font-bold text-[#222222]">Select dates</h2>
            <p className="text-sm text-gray-500 mt-1">Check-in and check-out to see availability</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={month <= minMonth}
              className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 disabled:opacity-20 transition-all active:scale-95 shadow-sm"
            >
              <IoChevronBack className="text-lg" />
            </button>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={month >= maxMonth}
              className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 disabled:opacity-20 transition-all active:scale-95 shadow-sm"
            >
              <IoChevronForward className="text-lg" />
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-center w-full">
        <DayPicker
          mode="range"
          month={month}
          onMonthChange={setMonth}
          numberOfMonths={isLg ? 2 : 1}
          selected={range}
          onSelect={handleSelectRange}
          disabled={disabledDays}
          excludeDisabled
          showOutsideDays
          hideNavigation
          classNames={{
            months: "flex flex-col md:flex-row gap-12 justify-center",
            month: "space-y-6",
            caption: "flex justify-center pt-1 relative items-center mb-6",
            caption_label: "text-[16px] font-bold text-[#222222]",
            month_grid: "w-full border-collapse",
            weekdays: "flex mb-4",
            weekday: "text-gray-400 w-11 font-bold text-[10px] uppercase tracking-widest text-center",
            week: "flex w-full mt-1",
            day: "p-0 relative focus-within:z-20",
            day_button: "h-11 w-11 p-0 font-bold aria-selected:opacity-100 hover:bg-gray-100 rounded-full transition-all flex items-center justify-center text-[14px] border-none bg-transparent cursor-pointer",
            selected: "bg-[#222222] rounded-full",
            range_start: "bg-[#222222] !text-white rounded-full",
            range_end: "bg-[#222222] !text-white rounded-full",
            range_middle: "!bg-[#f7f7f7] !text-[#222222] !rounded-none font-bold",
            today: "after:content-[''] after:absolute after:bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-[#222222] after:rounded-full relative",
            outside: "text-gray-300 opacity-50",
            disabled: "text-gray-200 line-through cursor-not-allowed opacity-30",
            hidden: "invisible",
          }}
        />
      </div>

      {!hideHeader && (
        <div className="mt-8 flex justify-between items-center border-t border-gray-100 pt-6 px-2">
          <button
            onClick={() => onSelectRange(undefined)}
            className="text-sm font-bold text-[#222222] underline hover:text-black transition-colors focus:outline-none"
          >
            Clear dates
          </button>
          {isLoadingAvailability && (
            <div className="flex items-center gap-2 text-xs text-[#1A1A1A] font-medium animate-pulse">
              Updating availability...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatePicker;