import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { type DateRange } from "react-day-picker";
import ImageShowcase from "../components/ImageShowcase";
import AmenitiesSection from "../components/AmenitiesSection";
import DynamicModal from "../components/DynamicModal";
import DatePicker from "../components/DatePicker";
import ReservationCard from "../components/ReservationCard";
import Booking from "../components/Booking";
import { UnitLocationMap } from "../components/unit-detail/UnitLocationMap";
import { getUnitById, type UnitSummary } from "../api/units";

type OpenModal = "amenities" | "about" | null;

type Amenity = {
  img: string;
  title: string;
  available?: boolean;
};

type GuestState = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

type LoadState = "loading" | "not-found" | "error" | "ready";

const FALLBACK_IMAGE =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerlobby.jpeg";

const asText = (value?: string | null) => (value && value.trim().length > 0 ? value.trim() : undefined);

const buildAddressLine = (unit: UnitSummary): string | null => {
  const parts = [asText(unit.street_address), asText(unit.city), asText(unit.state), asText(unit.country)]
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
};

const UnitDetailPage = ({ unitIdOverride }: { unitIdOverride?: string }) => {
  const { t } = useTranslation();
  const { unitId: urlUnitId } = useParams();
  const unitId = unitIdOverride || urlUnitId;
  const calendarRef = useRef<HTMLDivElement>(null);
  const mobileReservationRef = useRef<HTMLDivElement>(null);
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [unit, setUnit] = useState<UnitSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingPayload, setBookingPayload] = useState<any>(null);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [guestState, setGuestState] = useState<GuestState>({ adults: 1, children: 0, infants: 0, pets: 0 });

  useEffect(() => {
    if (range?.from && range?.to && mobileReservationRef.current) {
      const isLg = window.matchMedia("(min-width: 1024px)").matches;
      if (!isLg) {
        mobileReservationRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [range?.from, range?.to]);

  useEffect(() => {
    if (!unitId) {
      setLoadState("not-found");
      return;
    }
    let isMounted = true;
    const loadUnit = async () => {
      try {
        setLoadState("loading");
        const selected = await getUnitById(unitId);
        if (isMounted) {
          setUnit(selected);
          setLoadState("ready");
        }
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "";
        if (message === "Unit not found" || message.includes("404")) {
          setLoadState("not-found");
        } else {
          setLoadState("error");
        }
      }
    };
    loadUnit();
    return () => {
      isMounted = false;
    };
  }, [unitId]);

  const images = useMemo(() => {
    const source = unit?.image_urls?.filter((v): v is string => typeof v === "string" && v.trim().length > 0) ?? [];
    return source.length > 0 ? source : [FALLBACK_IMAGE];
  }, [unit]);

  const detailLines = useMemo(() => {
    if (!unit) return [];
    const location = [asText(unit.neighborhood), asText(unit.city), asText(unit.country)].filter(Boolean).join(", ");
    return [
      location,
      t("unitDetail.metaSummary", {
        guests: unit.max_guests,
        bedrooms: unit.bedrooms || 0,
        beds: unit.beds || 0,
        bathrooms: 0,
      }),
    ].filter(Boolean) as string[];
  }, [unit, t]);

  const primaryAmenities: Amenity[] = [];

  const handleReserve = (data: any) => {
    setBookingPayload({
      listing: {
        id: unit?.id,
        title: unit?.name || "",
        pricePerNight: unit?.nightly_rate_usd ?? 0,
        image: images[0],
      },
      selectedDates: data.selectedDates,
      guestCount: data.guestCount,
    });
    setIsBookingOpen(true);
  };

  if (loadState === "loading") {
    return (
      <div className="pl-container py-24">
        <div className="space-y-6">
          <div className="h-10 w-2/3 animate-pulse bg-stone" />
          <div className="h-5 w-1/3 animate-pulse bg-stone" />
          <div className="aspect-[16/9] w-full animate-pulse bg-stone" />
        </div>
      </div>
    );
  }

  if (loadState === "not-found" || !unit) {
    return (
      <div className="pl-container py-24 text-center">
        <h2 className="font-display text-3xl text-charcoal">{t("unitDetail.notFoundTitle")}</h2>
        <p className="mt-3 text-sm text-charcoal-500">{t("unitDetail.notFoundBody")}</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="pl-container py-24 text-center">
        <h2 className="font-display text-3xl text-charcoal">{t("listing.errorTitle")}</h2>
        <p className="mt-3 text-sm text-charcoal-500">{t("listing.errorFallback")}</p>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="pl-btn-ghost mt-8"
        >
          <span>{t("listing.retry")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 md:px-8 lg:px-12 py-8">
      <ImageShowcase images={images} />

      <div className="mt-12 flex flex-col lg:flex-row gap-16 relative">
        <div className="flex-1 space-y-12">
          <section className="border-b border-stone/60 pb-10">
            <h1 className="text-3xl font-bold tracking-tight text-charcoal md:text-4xl">{unit.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[16px] text-charcoal-500">
              {detailLines.map((line, idx) => (
                <React.Fragment key={idx}>
                  <span>{line}</span>
                  {idx < detailLines.length - 1 && <span className="text-stone-dark">.</span>}
                </React.Fragment>
              ))}
            </div>
          </section>

          <section className="border-b border-stone/60 pb-10">
            <h3 className="text-xl font-bold text-charcoal mb-6">{t("unitDetail.aboutHeading")}</h3>
            <p className="text-charcoal-500 leading-relaxed text-[16px] whitespace-pre-line line-clamp-6">
              {unit.description || t("unitDetail.aboutFallback")}
            </p>
            <button
              onClick={() => setOpenModal("about")}
              className="mt-6 font-bold underline flex items-center gap-1 hover:opacity-70 transition-opacity"
            >
              {t("unitDetail.showMore")} <span className="text-lg">{">"}</span>
            </button>
          </section>

          <section className="pb-10" ref={calendarRef}>
            <DatePicker unitId={unit.id} range={range} onSelectRange={setRange} />
          </section>

          {/* Mobile: reservation card immediately after calendar, before amenities */}
          <div id="reservation-card-mobile" className="lg:hidden scroll-mt-24" ref={mobileReservationRef}>
            <ReservationCard
              unitId={unit.id}
              nightlyRateUsd={unit.nightly_rate_usd ?? 0}
              maxGuests={unit.max_guests}
              range={range}
              onSelectRange={setRange}
              totalGuests={guestState.adults + guestState.children}
              guestState={guestState}
              onUpdateGuests={setGuestState}
              onReserve={handleReserve}
            />
          </div>

          {primaryAmenities.length > 0 && (
            <section className="border-b border-stone/60 pb-10">
              <AmenitiesSection
                amenities={primaryAmenities}
                maxVisible={10}
                onShowAll={() => setOpenModal("amenities")}
              />
            </section>
          )}

          <UnitLocationMap
            unitName={unit.name}
            neighborhood={asText(unit.neighborhood) ?? null}
            addressLine={buildAddressLine(unit)}
            latitude={unit.latitude ?? null}
            longitude={unit.longitude ?? null}
            googleMapsUrl={unit.google_maps_url ?? null}
          />
        </div>

        {/* Desktop: sticky sidebar reservation card */}
        <div id="reservation-card-desktop" className="hidden lg:block lg:w-[420px] shrink-0 scroll-mt-28">
          <div className="lg:sticky lg:top-28">
            <ReservationCard
              unitId={unit.id}
              nightlyRateUsd={unit.nightly_rate_usd ?? 0}
              maxGuests={unit.max_guests}
              range={range}
              onSelectRange={setRange}
              totalGuests={guestState.adults + guestState.children}
              guestState={guestState}
              onUpdateGuests={setGuestState}
              onReserve={handleReserve}
            />
          </div>
        </div>
      </div>

      <DynamicModal
        open={openModal === "amenities"}
        onClose={() => setOpenModal(null)}
        title={t("unitDetail.amenitiesHeading")}
        mode="amenities"
        sections={[{ heading: t("unitDetail.amenitiesSection"), items: primaryAmenities }]}
      />

      <DynamicModal
        open={openModal === "about"}
        onClose={() => setOpenModal(null)}
        title={t("unitDetail.aboutHeading")}
        mode="text"
        sections={[{ heading: t("unitDetail.aboutHeading"), paragraphs: [unit.description || ""] }]}
      />

      <Booking
        open={isBookingOpen}
        bookingData={bookingPayload}
        onClose={() => setIsBookingOpen(false)}
      />
    </div>
  );
};

export default UnitDetailPage;
