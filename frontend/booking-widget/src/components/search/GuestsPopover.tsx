import { useEffect, useRef, useState } from "react";
import { IoPersonOutline } from "react-icons/io5";

type GuestsPopoverProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  maxCapacity?: number;
};

export function GuestsPopover({ value, onChange, maxCapacity = 8 }: GuestsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const current = value ?? 0;
  const decrement = () => onChange(current > 1 ? current - 1 : null);
  const increment = () => onChange(Math.min(maxCapacity, current + 1 || 1));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border border-stone-dark/60 bg-cream px-5 py-3.5 text-left transition-all duration-300 hover:border-gold focus:border-gold focus:outline-none"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IoPersonOutline className="h-4 w-4 text-charcoal-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[0.625rem] font-medium uppercase tracking-[0.22em] text-charcoal-400">
            Huespedes
          </div>
          <div className="mt-0.5 truncate text-sm text-charcoal">
            {value == null
              ? "Cualquier cantidad"
              : `${value} ${value === 1 ? "huesped" : "huespedes"}`}
          </div>
        </div>
      </button>

      {open ? (
        <div
          role="dialog"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 border border-stone-dark/50 bg-cream p-5 shadow-2xl shadow-charcoal/10 md:min-w-[280px]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-lg text-charcoal">Huespedes</div>
              <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-charcoal-400">
                Capacidad minima
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={decrement}
                disabled={current <= 0}
                className="flex h-9 w-9 items-center justify-center border border-charcoal/40 text-charcoal transition-all hover:border-gold hover:text-gold disabled:opacity-40"
                aria-label="Quitar huesped"
              >
                -
              </button>
              <div className="w-6 text-center font-display text-xl text-charcoal">
                {current}
              </div>
              <button
                type="button"
                onClick={increment}
                disabled={current >= maxCapacity}
                className="flex h-9 w-9 items-center justify-center border border-charcoal/40 text-charcoal transition-all hover:border-gold hover:text-gold disabled:opacity-40"
                aria-label="Agregar huesped"
              >
                +
              </button>
            </div>
          </div>
          {value != null ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-5 w-full border-t border-stone pt-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-charcoal-500 hover:text-charcoal"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
