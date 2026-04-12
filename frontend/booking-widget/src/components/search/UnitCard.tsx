import { Link } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ImageCarousel } from "../ImageCarousel";
import type { UnitListing } from "../../lib/unit-types";

type UnitCardProps = {
  unit: UnitListing;
  index?: number;
};

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function UnitCard({ unit, index = 0 }: UnitCardProps) {
  const reduce = useReducedMotion();
  const priceLabel = unit.pricePerNightUsd.toLocaleString("en-US");

  const bedroomsLabel =
    unit.bedrooms === 0
      ? "Studio"
      : `${unit.bedrooms} ${unit.bedrooms === 1 ? "habitacion" : "habitaciones"}`;
  const guestsLabel = `${unit.maxGuests} ${unit.maxGuests === 1 ? "huesped" : "huespedes"}`;
  const meta = [bedroomsLabel, guestsLabel].join(" . ");

  return (
    <motion.article
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 32 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, delay: Math.min(index * 0.06, 0.4), ease: EXPO_OUT }}
      className="group"
    >
      <Link to={`/${unit.id}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone">
          <ImageCarousel images={unit.images} alt={unit.name} rounded={false} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/45 via-charcoal/0 to-charcoal/0 opacity-80 transition-opacity duration-500 group-hover:opacity-100" />

          <div className="absolute left-4 top-4 flex items-center gap-2 border border-cream/30 bg-charcoal/40 px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.22em] text-cream backdrop-blur-sm">
            <span className="h-1 w-1 rounded-full bg-gold" />
            Disponible
          </div>
        </div>

        <div className="mt-5">
          {unit.neighborhood ? (
            <div className="text-[0.625rem] font-medium uppercase tracking-[0.22em] text-gold-dark">
              {unit.neighborhood}
            </div>
          ) : null}
          <h3 className="mt-2 font-display text-2xl leading-tight text-charcoal md:text-[1.75rem]">
            {unit.name}
          </h3>
          <p className="mt-2 text-xs text-charcoal-500">{meta}</p>

          <div className="mt-5 flex items-end justify-between gap-4 border-t border-stone/80 pt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[1.75rem] font-medium leading-none text-charcoal">
                ${priceLabel}
              </span>
              <span className="text-xs font-medium text-charcoal-500">USD / noche</span>
            </div>
            <span className="pl-link text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-charcoal transition-colors group-hover:text-gold">
              Ver loft
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
