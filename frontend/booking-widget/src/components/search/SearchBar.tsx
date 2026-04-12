import { DateRangePopover } from "./DateRangePopover";
import { GuestsPopover } from "./GuestsPopover";
import type { UnitFilterState } from "../../lib/unit-types";

type SearchBarProps = {
  filters: UnitFilterState;
  onChange: (patch: Partial<UnitFilterState>) => void;
};

export function SearchBar({ filters, onChange }: SearchBarProps) {
  return (
    <div className="border border-stone-dark/40 bg-cream-50 p-4 md:p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-stretch">
        <DateRangePopover
          checkIn={filters.checkIn}
          checkOut={filters.checkOut}
          onChange={({ checkIn, checkOut }) => onChange({ checkIn, checkOut })}
        />
        <GuestsPopover
          value={filters.guests}
          onChange={(guests) => onChange({ guests })}
        />
        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: document.getElementById("results")?.offsetTop ?? 0,
              behavior: "smooth",
            })
          }
          className="pl-btn-primary md:px-8"
        >
          <span>Buscar</span>
        </button>
      </div>
    </div>
  );
}
