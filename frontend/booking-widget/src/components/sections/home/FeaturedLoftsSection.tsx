import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { getUnits, type UnitSummary } from "../../../api/units";
import type { ListingCardData } from "../../../pages/UnitListingPage";
import { UnitCard } from "../../UnitCard";
import { Eyebrow } from "../../common/Eyebrow";
import { TextReveal } from "../../common/TextReveal";
import { FadeIn } from "../../common/FadeIn";

const FALLBACK_IMAGE =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerlobby.jpeg";

// Hard-coded sample lofts used as visual fallback while real units are being
// ingested into the database. The moment the API returns a non-empty list,
// these vanish and the real data takes over.
const SAMPLE_LOFTS: ListingCardData[] = [
  {
    id: "sample-tower-1902",
    title: "Loft Tower 1902",
    subtitle: "Park Lofts Tower, Recoleta",
    pricePerNight: 119,
    meta: "1 habitacion · 2 huespedes · Vista 360",
    images: [
      "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerinterior2.jpg.jpg",
      "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerlobby.jpeg",
    ],
    currencySymbol: "$",
  },
  {
    id: "sample-recoleta-702",
    title: "Loft Recoleta 702",
    subtitle: "Park Lofts Recoleta",
    pricePerNight: 89,
    meta: "Studio · 2 huespedes · Terraza",
    images: [
      "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/news/recoleta/under%20construction/23.02.2026/recoletaunderconstructioninside.jpg",
      "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/news/recoleta/under%20construction/23.02.2026/recoletaconstructionrooftopbestview.JPG",
    ],
    currencySymbol: "$",
  },
  {
    id: "sample-airport-301",
    title: "Loft Airport 301",
    subtitle: "Park Lofts Airport",
    pricePerNight: 75,
    meta: "Studio · 2 huespedes · 12 min aeropuerto",
    images: [
      "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/airport/airport200.jpg",
      FALLBACK_IMAGE,
    ],
    currencySymbol: "$",
  },
];

const asText = (val: string | number | null | undefined) =>
  val != null && String(val).trim().length > 0 ? String(val).trim() : undefined;

function toListingCard(unit: UnitSummary): ListingCardData {
  const city = asText(unit.city);
  const country = asText(unit.country);
  const category = asText(unit.category);
  const bedrooms = Number(unit.bedrooms || 0);

  const images = Array.isArray(unit.image_urls)
    ? unit.image_urls.filter(
        (v): v is string => typeof v === "string" && v.trim().length > 0,
      )
    : [];

  return {
    id: unit.id,
    title: unit.name || "Loft Park Lofts",
    images: images.length > 0 ? images : [FALLBACK_IMAGE],
    pricePerNight: unit.weekday_price ?? unit.nightly_rate_usd ?? 0,
    subtitle: [city, country].filter(Boolean).join(", "),
    meta: [
      category,
      bedrooms > 0
        ? `${bedrooms} habitacion${bedrooms === 1 ? "" : "es"}`
        : undefined,
      `${unit.max_guests} huesped${unit.max_guests === 1 ? "" : "es"}`,
    ]
      .filter(Boolean)
      .join(" · "),
    currencySymbol: "$",
  };
}

export function FeaturedLoftsSection() {
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getUnits();
        if (mounted) setUnits(data);
      } catch (err) {
        if (mounted)
          setError(err instanceof Error ? err.message : "No pudimos cargar los lofts");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => {
    const real = units.map(toListingCard);
    return real.length > 0 ? real : SAMPLE_LOFTS;
  }, [units]);

  const [hero, ...rest] = items;

  return (
    <section id="lofts" className="relative bg-cream py-[var(--section-padding-y)]">
      <div className="pl-container">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <FadeIn>
              <Eyebrow>Lofts disponibles</Eyebrow>
            </FadeIn>
            <div className="mt-6">
              <TextReveal
                as="h2"
                lines={["El producto, no la promesa.", "Elegi tu proximo loft."]}
                className="font-display text-display font-light text-charcoal"
              />
            </div>
          </div>
          <FadeIn delay={0.2}>
            <p className="max-w-xs text-sm leading-relaxed text-charcoal-500">
              Cada loft lo operamos directamente. Sin intermediarios, sin sorpresas, con el mismo
              estandar en cada llave.
            </p>
          </FadeIn>
        </div>

        {/* Error state */}
        {error ? (
          <div className="mt-16 border border-stone bg-cream-50 p-10 text-center">
            <span className="pl-gold-rule" />
            <p className="mt-6 font-display text-2xl text-charcoal">Estamos con una pausa tecnica</p>
            <p className="mt-3 text-sm text-charcoal-500">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="pl-btn-primary mt-8"
              type="button"
            >
              <span>Reintentar</span>
            </button>
          </div>
        ) : null}

        {/* Loading state */}
        {loading && !error ? <FeaturedLoftsSkeleton /> : null}

        {/* Loaded state: asymmetric grid, 1 hero + 2 companions, then rest in regular grid */}
        {!loading && !error && items.length > 0 ? (
          <>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
              }}
              className="mt-16 grid gap-6 md:mt-20 md:grid-cols-12 md:gap-8"
            >
              {hero ? (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 40 },
                    show: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } },
                  }}
                  className="md:col-span-7"
                >
                  <Link to={`/${hero.id}`}>
                    <UnitCard data={hero} variant="hero" />
                  </Link>
                </motion.div>
              ) : null}

              {rest.slice(0, 2).map((item) => (
                <motion.div
                  key={item.id}
                  variants={{
                    hidden: { opacity: 0, y: 40 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                  className="md:col-span-5"
                >
                  <Link to={`/${item.id}`}>
                    <UnitCard data={item} />
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            {rest.length > 2 ? (
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.1 }}
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.12 } },
                }}
                className="mt-10 grid gap-6 md:mt-12 md:grid-cols-3 md:gap-8"
              >
                {rest.slice(2).map((item) => (
                  <motion.div
                    key={item.id}
                    variants={{
                      hidden: { opacity: 0, y: 40 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
                      },
                    }}
                  >
                    <Link to={`/${item.id}`}>
                      <UnitCard data={item} />
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ) : null}
          </>
        ) : null}

        {/* Empty state */}
        {!loading && !error && items.length === 0 ? (
          <div className="mt-16 border border-stone bg-cream-50 p-12 text-center">
            <span className="pl-gold-rule" />
            <h3 className="mt-6 font-display text-3xl text-charcoal">Proximamente</h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-charcoal-500">
              Estamos preparando nuevas experiencias. Escribinos a reservas@parkloftsparaguay.com y
              te avisamos apenas esten disponibles.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FeaturedLoftsSkeleton() {
  return (
    <div className="mt-16 grid gap-6 md:mt-20 md:grid-cols-12 md:gap-8">
      <div className="md:col-span-7">
        <div className="aspect-[4/5] w-full animate-pulse bg-stone md:aspect-[3/4]" />
        <div className="mt-5 h-4 w-2/3 animate-pulse bg-stone" />
        <div className="mt-3 h-3 w-1/2 animate-pulse bg-stone" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="md:col-span-5">
          <div className="aspect-[3/4] w-full animate-pulse bg-stone" />
          <div className="mt-5 h-4 w-2/3 animate-pulse bg-stone" />
          <div className="mt-3 h-3 w-1/2 animate-pulse bg-stone" />
        </div>
      ))}
    </div>
  );
}
