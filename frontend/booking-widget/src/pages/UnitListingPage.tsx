import React, { useEffect, useMemo, useState } from "react";
import { getUnits, type UnitSummary } from "../api/units";
import { UnitCardGrid } from "../components/UnitCardsGrid";

export interface ListingCardData {
    id: string;
    title: string;
    images: string[];
    pricePerNight: number;
    subtitle?: string;
    meta?: string;
    currencySymbol?: string;
    originalPricePerNight?: number;
    cancellationText?: string;
}

const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=1200&q=80";

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

export default function UnitListingPage() {
    const [units, setUnits] = useState<UnitSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadUnits = async () => {
            try {
                setIsLoading(true);
                const data = await getUnits();
                if (isMounted) {
                    setUnits(data);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "No pudimos cargar los lofts. Probalo de nuevo en unos segundos.",
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadUnits();
        return () => {
            isMounted = false;
        };
    }, []);

    const items = useMemo(() => units.map(toListingCard), [units]);

    return (
        <div>
            <Hero />

            <section className="pl-container pb-24">
                {error ? (
                    <div className="border border-gold/40 bg-cream-50 p-8 text-center">
                        <p className="font-display text-2xl text-charcoal">
                            Estamos con una pausa tecnica
                        </p>
                        <p className="mt-3 text-sm text-charcoal-500">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="pl-btn-primary mt-6"
                        >
                            Reintentar
                        </button>
                    </div>
                ) : null}

                {isLoading && !error ? <LoftsGridSkeleton /> : null}

                {!isLoading && !error && items.length === 0 ? (
                    <div className="border border-stone bg-cream-50 px-8 py-20 text-center">
                        <span className="pl-gold-rule" />
                        <h2 className="mt-6 font-display text-3xl text-charcoal">
                            Proximamente
                        </h2>
                        <p className="mx-auto mt-3 max-w-md text-sm text-charcoal-500">
                            Estamos preparando nuevas experiencias. Escribinos a
                            reservas@parkloftsparaguay.com y te avisamos apenas esten
                            disponibles.
                        </p>
                    </div>
                ) : null}

                {!isLoading && !error && items.length > 0 ? (
                    <UnitCardGrid items={items} />
                ) : null}
            </section>
        </div>
    );
}

function Hero() {
    return (
        <section className="pl-container pt-20 pb-16 md:pt-28 md:pb-20">
            <div className="max-w-4xl">
                <span className="pl-gold-rule" />
                <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-charcoal md:text-7xl">
                    Lofts de autor en el corazon de Asuncion
                </h1>
                <p className="mt-8 max-w-2xl text-base leading-relaxed text-charcoal-500 md:text-lg">
                    Estancias cortas con diseno pensado al detalle, servicio atento y
                    pagos 100 por ciento seguros. Reservas confirmadas al instante.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-6 text-[0.625rem] uppercase tracking-[0.25em] text-charcoal-400">
                    <span className="flex items-center gap-2">
                        <span className="h-px w-6 bg-gold" />
                        Diseno de autor
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-px w-6 bg-gold" />
                        Reserva en minutos
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-px w-6 bg-gold" />
                        Pago seguro Bancard
                    </span>
                </div>
            </div>
        </section>
    );
}

function LoftsGridSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="animate-pulse">
                    <div className="aspect-[4/5] w-full bg-stone" />
                    <div className="mt-4 h-3 w-3/4 bg-stone" />
                    <div className="mt-2 h-3 w-1/2 bg-stone" />
                </div>
            ))}
        </div>
    );
}
