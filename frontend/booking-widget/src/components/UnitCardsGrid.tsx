import { Link } from "react-router";
import { ListingCardData } from "../pages/UnitListingPage";
import { UnitCard } from "./UnitCard";

export function UnitCardGrid({ items }: { items: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-6  sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <Link key={it.id} to={`/${it.id}`}>
          <UnitCard data={it} />
        </Link>
      ))}
    </div>
  );
}
