import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import { format, parseISO, startOfDay, addMonths, startOfMonth } from "date-fns";
import { IoCalendarOutline } from "react-icons/io5";
import "react-day-picker/dist/style.css";
import "../DatePicker.css";

type DateRangePopoverProps = {
  checkIn: string | null;
  checkOut: string | null;
  onChange: (range: { checkIn: string | null; checkOut: string | null }) => void;
};

const FORMAT = "yyyy-MM-dd";

const parseIso = (value: string | null): Date | undefined => {
  if (!value) return undefined;
  try {
    return parseISO(value);
  } catch {
    return undefined;
  }
};

const displayLabel = (checkIn: string | null, checkOut: string | null): string => {
  if (!checkIn && !checkOut) return "Fechas";
  const dateFmt = (iso: string) => {
    try {
      return format(parseISO(iso), "dd MMM");
    } catch {
      return iso;
    }
  };
  if (checkIn && checkOut) return `${dateFmt(checkIn)} -> ${dateFmt(checkOut)}`;
  if (checkIn) return `Desde ${dateFmt(checkIn)}`;
  return `Hasta ${dateFmt(checkOut!)}`;
};

export function DateRangePopover({ checkIn, checkOut, onChange }: DateRangePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = startOfDay(new Date());
  const fromMonth = startOfMonth(today);
  const toMonth = addMonths(today, 12);

  const selected: DateRange | undefined = (() => {
    const from = parseIso(checkIn);
    const to = parseIso(checkOut);
    if (!from && !to) return undefined;
    return { from, to };
  })();

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleSelect = (range: DateRange | undefined) => {
    onChange({
      checkIn: range?.from ? format(range.from, FORMAT) : null,
      checkOut: range?.to ? format(range.to, FORMAT) : null,
    });
  };

  const handleClear = () => {
    onChange({ checkIn: null, checkOut: null });
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border border-stone-dark/60 bg-cream px-5 py-3.5 text-left transition-all duration-300 hover:border-gold focus:border-gold focus:outline-none"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IoCalendarOutline className="h-4 w-4 text-charcoal-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[0.625rem] font-medium uppercase tracking-[0.22em] text-charcoal-400">
            Check-in / Check-out
          </div>
          <div className="mt-0.5 truncate text-sm text-charcoal">
            {displayLabel(checkIn, checkOut)}
          </div>
        </div>
      </button>

      {open ? (
        <div
          role="dialog"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 w-full min-w-[280px] border border-stone-dark/50 bg-cream p-5 shadow-2xl shadow-charcoal/10 md:left-auto md:right-auto md:w-auto"
        >
          <DayPicker
            mode="range"
            numberOfMonths={1}
            selected={selected}
            onSelect={handleSelect}
            fromMonth={fromMonth}
            toMonth={toMonth}
            disabled={{ before: today }}
            weekStartsOn={1}
            showOutsideDays
          />
          <div className="mt-4 flex items-center justify-between border-t border-stone pt-4">
            <button
              type="button"
              onClick={handleClear}
              className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-charcoal-500 hover:text-charcoal"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-gold hover:text-gold-dark"
            >
              Listo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
