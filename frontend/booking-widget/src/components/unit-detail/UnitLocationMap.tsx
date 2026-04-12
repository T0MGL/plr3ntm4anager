import { useEffect, useRef, useState } from "react";
import { IoLocationOutline, IoOpenOutline } from "react-icons/io5";

type UnitLocationMapProps = {
  unitName: string;
  neighborhood: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
};

type LoadState = "idle" | "loading" | "ready" | "error";

/**
 * Custom Google Maps style tuned to the Park Lofts cream / charcoal / gold
 * palette. Built off the Snazzy Maps "Subtle Grayscale" baseline with tinted
 * cream backgrounds, muted water, and hidden points of interest so the
 * neighborhood reads as a location, not a tourist map.
 */
const PARK_LOFTS_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#F6F2EC" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F6F2EC" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4A4A4A" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#EDE5D8" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#6B6B6B" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#8A8A8A" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#EDEAE4" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#EDE5D8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#E0D4C0" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FDFBF8" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#6B6B6B" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#E2DDD4" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#4A4A4A" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#8A8A8A" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#C8C2B6" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6B6B6B" }] },
];

const GOLD_PIN_SVG =
  "M20 2C13.9 2 9 6.9 9 13c0 8.1 9.8 22.5 10.2 23.1.2.3.5.5.8.5s.6-.2.8-.5C21.2 35.5 31 21.1 31 13c0-6.1-4.9-11-11-11zm0 15.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z";

const buildFallbackMapsUrl = (
  lat: number,
  lng: number,
  label: string,
): string => {
  const query = encodeURIComponent(`${label} @${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

export function UnitLocationMap({
  unitName,
  neighborhood,
  addressLine,
  latitude,
  longitude,
  googleMapsUrl,
}: UnitLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");

  const hasCoords = latitude != null && longitude != null;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const resolvedMapsUrl =
    googleMapsUrl ?? (hasCoords ? buildFallbackMapsUrl(latitude!, longitude!, unitName) : null);

  useEffect(() => {
    if (!hasCoords || !apiKey) {
      setLoadState("idle");
      return;
    }
    const container = mapContainerRef.current;
    if (!container) return;

    let cancelled = false;
    setLoadState("loading");

    (async () => {
      try {
        const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
        setOptions({ key: apiKey, v: "weekly" });

        const [{ Map }, { Marker }, { Point }] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
          importLibrary("core"),
        ]);
        if (cancelled || !container) return;

        const position = { lat: latitude!, lng: longitude! };

        const map = new Map(container, {
          center: position,
          zoom: 15,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
          styles: PARK_LOFTS_MAP_STYLE,
          backgroundColor: "#F6F2EC",
        });

        const marker = new Marker({
          position,
          map,
          title: unitName,
          optimized: false,
          icon: {
            path: GOLD_PIN_SVG,
            fillColor: "#C4A96B",
            fillOpacity: 1,
            strokeColor: "#1A1A1A",
            strokeWeight: 1.25,
            scale: 1.1,
            anchor: new Point(20, 36),
          },
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setLoadState("ready");
      } catch (err) {
        if (cancelled) return;
        console.warn("Failed to load Google Maps", err);
        setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapInstanceRef.current = null;
    };
  }, [apiKey, hasCoords, latitude, longitude, unitName]);

  const locationLine = [neighborhood, addressLine].filter(Boolean).join(" . ");

  return (
    <section className="border-t border-stone/60 pt-12">
      <div className="flex items-start justify-between gap-6">
        <div>
          <span className="pl-eyebrow">Donde estaras</span>
          <h3 className="mt-4 font-display text-3xl leading-tight text-charcoal md:text-[2rem]">
            {neighborhood ?? unitName}
          </h3>
          {addressLine ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-charcoal-500">
              <IoLocationOutline className="h-4 w-4 text-gold" aria-hidden />
              {addressLine}
            </p>
          ) : null}
        </div>

        {resolvedMapsUrl ? (
          <a
            href={resolvedMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pl-btn-ghost hidden shrink-0 items-center gap-2 md:inline-flex"
          >
            <span>Abrir en Maps</span>
            <IoOpenOutline className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="relative mt-7 overflow-hidden border border-stone-dark/50 bg-stone-light">
        <div
          ref={mapContainerRef}
          className="h-[280px] w-full md:h-[400px]"
          aria-label={`Mapa de ${locationLine || unitName}`}
          role="img"
        />

        {loadState !== "ready" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-light">
            {loadState === "loading" ? (
              <div className="flex flex-col items-center gap-3">
                <span className="h-1 w-12 animate-pulse bg-charcoal/40" />
                <span className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-charcoal-400">
                  Cargando mapa
                </span>
              </div>
            ) : (
              <div className="flex max-w-xs flex-col items-center gap-4 px-8 text-center">
                <IoLocationOutline className="h-10 w-10 text-gold" aria-hidden />
                <p className="text-sm text-charcoal-500">
                  {hasCoords && !apiKey
                    ? "Configura VITE_GOOGLE_MAPS_API_KEY para mostrar el mapa interactivo."
                    : hasCoords
                    ? "No se pudo cargar el mapa. Usa el boton para abrir en Google Maps."
                    : "Abre la ubicacion exacta en Google Maps."}
                </p>
                {resolvedMapsUrl ? (
                  <a
                    href={resolvedMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pl-btn-primary"
                  >
                    <span>Abrir en Google Maps</span>
                  </a>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {resolvedMapsUrl ? (
        <div className="mt-5 flex md:hidden">
          <a
            href={resolvedMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pl-btn-ghost inline-flex items-center gap-2"
          >
            <span>Abrir en Google Maps</span>
            <IoOpenOutline className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      ) : null}
    </section>
  );
}
