import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { IoChevronUp, IoChevronDown, IoRemove, IoAdd, IoCloseOutline } from "react-icons/io5";
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
    onReserve: (data: any) => void;
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

    const updateCount = (key: keyof GuestState, delta: number, min: number, max: number) => {
        const currentTotal = guestState.adults + guestState.children;
        if (key === "adults" || key === "children") {
            if (delta > 0 && currentTotal >= maxGuests) return;
        }
        const nextValue = Math.max(min, Math.min(max, guestState[key] + delta));
        onUpdateGuests({ ...guestState, [key]: nextValue });
    };

    const CounterRow = ({ title, sub, val, keyName, min, max }: any) => (
        <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
            <div>
                <div className="font-bold text-[15px]">{title}</div>
                <div className="text-xs text-gray-500">{sub}</div>
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={() => updateCount(keyName, -1, min, max)}
                    disabled={val <= min}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-black disabled:opacity-20 transition-all font-bold"
                >
                    <IoRemove />
                </button>
                <span className="w-4 text-center font-medium">{val}</span>
                <button
                    onClick={() => updateCount(keyName, 1, min, max)}
                    disabled={val >= max || (keyName !== 'infants' && keyName !== 'pets' && (guestState.adults + guestState.children) >= maxGuests)}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-black disabled:opacity-20 transition-all font-bold"
                >
                    <IoAdd />
                </button>
            </div>
        </div>
    );

    return (
        <div className="relative group" ref={cardRef}>
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-6 w-full max-w-[420px] mx-auto transition-all duration-300 hover:shadow-2xl">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <span className="text-2xl font-bold">${nightlyRateUsd}</span>
                        <span className="text-gray-600 ml-1">night</span>
                    </div>
                </div>

                <div className="border border-gray-400 rounded-xl overflow-hidden mb-4 bg-white relative">
                    <div className="grid grid-cols-2 border-b border-gray-400 relative">
                        <button
                            onClick={() => { setCalendarOpen(true); setGuestOpen(false); }}
                            className={`p-3 text-left border-r border-gray-400 hover:bg-gray-50 transition-colors ${calendarOpen ? 'bg-gray-100' : ''}`}
                        >
                            <div className="text-[10px] font-bold uppercase tracking-wider">Check-in</div>
                            <div className="text-sm font-medium">{range?.from ? format(range.from, "MM/dd/yyyy") : "Add date"}</div>
                        </button>
                        <button
                            onClick={() => { setCalendarOpen(true); setGuestOpen(false); }}
                            className={`p-3 text-left hover:bg-gray-50 transition-colors ${calendarOpen ? 'bg-gray-100' : ''}`}
                        >
                            <div className="text-[10px] font-bold uppercase tracking-wider">Check-out</div>
                            <div className="text-sm font-medium">{range?.to ? format(range.to, "MM/dd/yyyy") : "Add date"}</div>
                        </button>

                        {/* Calendar Popover */}
                        {calendarOpen && (
                            <div
                                ref={calendarRef}
                                className="absolute top-[-20px] right-0 lg:right-[-20px] z-[100] bg-white border border-gray-200 shadow-[0_10px_40px_rgba(0,0,0,0.2)] rounded-3xl p-8 w-[95vw] sm:w-[500px] lg:w-[850px] animate-in fade-in zoom-in-95 duration-200 origin-top-right"
                            >
                                <div className="flex justify-end mb-4">
                                    <button
                                        onClick={() => setCalendarOpen(false)}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <IoCloseOutline className="text-2xl" />
                                    </button>
                                </div>
                                <DatePicker
                                    unitId={unitId}
                                    range={range}
                                    onSelectRange={onSelectRange}
                                />
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={() => setCalendarOpen(false)}
                                        className="bg-black text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative" ref={guestRef}>
                        <button
                            onClick={() => { setGuestOpen(!guestOpen); setCalendarOpen(false); }}
                            className={`w-full p-3 text-left flex justify-between items-center hover:bg-gray-50 transition-colors ${guestOpen ? 'bg-gray-100' : ''}`}
                        >
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider">Guests</div>
                                <div className="text-sm font-medium">{totalGuests} guest{totalGuests !== 1 ? "s" : ""}{guestState.infants > 0 ? `, ${guestState.infants} infant${guestState.infants !== 1 ? "s" : ""}` : ""}</div>
                            </div>
                            {guestOpen ? <IoChevronUp /> : <IoChevronDown />}
                        </button>

                        {guestOpen && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                                <CounterRow title="Adults" sub="Age 13+" val={guestState.adults} keyName="adults" min={1} max={maxGuests} />
                                <CounterRow title="Children" sub="Ages 2–12" val={guestState.children} keyName="children" min={0} max={maxGuests} />
                                <CounterRow title="Infants" sub="Under 2" val={guestState.infants} keyName="infants" min={0} max={5} />
                                <CounterRow title="Pets" sub="Service animals" val={guestState.pets} keyName="pets" min={0} max={2} />
                                <p className="text-[11px] text-gray-500 mt-4 leading-tight opacity-75">
                                    This place has a maximum of {maxGuests} guest{maxGuests !== 1 ? 's' : ''}, not including infants.
                                </p>
                                <button
                                    onClick={() => setGuestOpen(false)}
                                    className="w-full mt-4 text-sm font-bold underline text-right hover:opacity-70 transition-opacity"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => hasValidDates && onReserve({ selectedDates: { checkIn: format(range!.from!, "yyyy-MM-dd"), checkOut: format(range!.to!, "yyyy-MM-dd") }, guestCount: totalGuests + guestState.infants, nights, totalPrice })}
                    disabled={!hasValidDates}
                    className={`w-full py-4 rounded-xl font-bold text-white transition-all transform active:scale-95 shadow-lg group-hover:brightness-110 ${hasValidDates ? "bg-[#A36D3A]" : "bg-gray-300 text-gray-400 cursor-not-allowed"}`}
                >
                    {hasValidDates ? "Reserve" : "Check availability"}
                </button>

                {hasValidDates && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-center text-sm text-gray-400">You won't be charged yet</p>
                        <div className="space-y-4 pt-2">
                            <div className="flex justify-between text-[16px] text-gray-600">
                                <span className="underline decoration-gray-300 decoration-1 underline-offset-4 cursor-default">${nightlyRateUsd} x {nights} nights</span>
                                <span>${totalPrice.toFixed(2)}</span>
                            </div>
                            {/* <div className="flex justify-between text-[16px] text-gray-600">
                                <span className="underline decoration-gray-300 decoration-1 underline-offset-4 cursor-default">Service fee</span>
                                <span>$0.00</span>
                            </div> */}
                            <div className="pt-6 border-t border-gray-100 flex justify-between font-bold text-[18px] text-[#222222]">
                                <span>Total Price</span>
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
