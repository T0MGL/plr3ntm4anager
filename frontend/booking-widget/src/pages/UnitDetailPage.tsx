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

const fallbackImage = "https://picsum.photos/1600/900?blur=1";

const amenityIcons = {
  default: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5213_qnbqbg.png",
  wifi: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770001/l_d_5243_ia6dvf.png",
  tv: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5213_qnbqbg.png",
  kitchen: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5291_ry1asq.png",
  washer: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5388_dvcpgw.png",
  freeParking: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5411_aphx5c.png",
  paidParking: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5499_nq0zz2.png",
  airConditioning: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769771269/l_d_5563_izqndj.png",
  workspace: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5536_pmledh.png",
  pool: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5575_dyplg0.png",
  hotTub: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5615_dcw0qm.png",
  patio: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5663_cfmqfb.png",
  bbq: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_5716_xsm7sb.png",
  dining: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_5785_awbhlf.png",
  firePit: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_5817_vcadcl.png",
  poolTable: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_5941_p8b0kp.png",
  indoorFireplace: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5981_ytb2rl.png",
  piano: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_6020_ckg39u.png",
  exercise: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_6073_tny0mh.png",
  lake: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6097_icgflz.png",
  beach: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_6205_gdpip3.png",
  ski: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6317_ccozya.png",
  outdoorShower: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6348_xgfbfw.png",
  smokeAlarm: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6542_yqhvdc.png",
  firstAid: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6577_qcmfth.png",
  fireExtinguisher: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_6636_oy4sas.png",
  carbonMonoxide: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_6677_cyzdbb.png",
};

const asText = (value?: string | null) => (value && value.trim().length > 0 ? value.trim() : undefined);

const normalizeItems = (items?: string[] | null): string[] => {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item))),
  );
};

const formatAmenityTitle = (title: string): string => {
  return title
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

const getAmenityIcon = (title: string): string => {
  const value = title.toLowerCase().replace(/_/g, " ");
  if (value.includes("kitchen")) return amenityIcons.kitchen;
  if (value.includes("wifi")) return amenityIcons.wifi;
  if (value.includes("air conditioning")) return amenityIcons.airConditioning;
  if (value.includes("workspace") || value.includes("dedicated workspace")) return amenityIcons.workspace;
  if (value.includes("free parking")) return amenityIcons.freeParking;
  if (value.includes("paid parking")) return amenityIcons.paidParking;
  if (value.includes("pool") && !value.includes("table")) return amenityIcons.pool;
  if (value.includes("hot tub")) return amenityIcons.hotTub;
  if (value.includes("washer")) return amenityIcons.washer;
  if (value === "tv" || value.includes("television") || value.includes("tv")) return amenityIcons.tv;
  if (value.includes("patio") || value.includes("balcony")) return amenityIcons.patio;
  if (value.includes("bbq") || value.includes("grill")) return amenityIcons.bbq;
  if (value.includes("dining")) return amenityIcons.dining;
  if (value.includes("fire pit")) return amenityIcons.firePit;
  if (value.includes("pool table")) return amenityIcons.poolTable;
  if (value.includes("indoor fireplace")) return amenityIcons.indoorFireplace;
  if (value.includes("piano")) return amenityIcons.piano;
  if (value.includes("exercise") || value.includes("gym")) return amenityIcons.exercise;
  if (value.includes("lake access") || value.includes("lake")) return amenityIcons.lake;
  if (value.includes("beach access") || value.includes("beach")) return amenityIcons.beach;
  if (value.includes("ski")) return amenityIcons.ski;
  if (value.includes("outdoor shower")) return amenityIcons.outdoorShower;
  if (value.includes("smoke alarm")) return amenityIcons.smokeAlarm;
  if (value.includes("first aid")) return amenityIcons.firstAid;
  if (value.includes("fire extinguisher")) return amenityIcons.fireExtinguisher;
  if (value.includes("carbon monoxide")) return amenityIcons.carbonMonoxide;
  return amenityIcons.default;
};

const mapAmenities = (items: string[]): Amenity[] => {
  return items.map((title) => ({
    title: formatAmenityTitle(title),
    img: getAmenityIcon(title),
    available: true,
  }));
};

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
  const [isLoading, setIsLoading] = useState(true);
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
    if (!unitId) return;
    let isMounted = true;
    const loadUnit = async () => {
      try {
        setIsLoading(true);
        const selected = await getUnitById(unitId);
        if (isMounted) setUnit(selected);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadUnit();
    return () => {
      isMounted = false;
    };
  }, [unitId]);

  const images = useMemo(() => {
    const source = unit?.image_urls?.filter((v): v is string => typeof v === "string" && v.trim().length > 0) ?? [];
    return source.length > 0 ? source : [fallbackImage];
  }, [unit]);

  const detailLines = useMemo(() => {
    if (!unit) return [];
    const location = [asText(unit.neighborhood), asText(unit.city), asText(unit.country)].filter(Boolean).join(", ");
    return [
      location,
      unit.category,
      t("unitDetail.metaSummary", {
        guests: unit.max_guests,
        bedrooms: unit.bedrooms || 0,
        beds: unit.beds || 0,
        bathrooms: unit.private_bathroom || 0,
      }),
    ].filter(Boolean) as string[];
  }, [unit, t]);

  const amenitySections = useMemo(() => {
    if (!unit) return [];
    const items = mapAmenities(normalizeItems(unit.amenities));
    return items.length > 0 ? [{ heading: t("unitDetail.amenitiesHeading"), items }] : [];
  }, [unit, t]);

  const primaryAmenities = amenitySections.flatMap((s) => s.items);

  const handleReserve = (data: any) => {
    setBookingPayload({
      listing: {
        id: unit?.id,
        title: unit?.name || "",
        pricePerNight: unit?.weekday_price ?? unit?.nightly_rate_usd ?? 0,
        image: images[0],
      },
      selectedDates: data.selectedDates,
      guestCount: data.guestCount,
    });
    setIsBookingOpen(true);
  };

  if (isLoading) {
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

  if (!unit) {
    return (
      <div className="pl-container py-24 text-center">
        <h2 className="font-display text-3xl text-charcoal">{t("unitDetail.notFoundTitle")}</h2>
        <p className="mt-3 text-sm text-charcoal-500">{t("unitDetail.notFoundBody")}</p>
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
              nightlyRateUsd={unit.weekday_price ?? unit.nightly_rate_usd ?? 0}
              maxGuests={unit.max_guests}
              range={range}
              onSelectRange={setRange}
              totalGuests={guestState.adults + guestState.children}
              guestState={guestState}
              onUpdateGuests={setGuestState}
              onReserve={handleReserve}
            />
          </div>

          <section className="border-b border-stone/60 pb-10">
            <AmenitiesSection
              amenities={primaryAmenities}
              maxVisible={10}
              onShowAll={() => setOpenModal("amenities")}
            />
          </section>

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
              nightlyRateUsd={unit.weekday_price ?? unit.nightly_rate_usd ?? 0}
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
