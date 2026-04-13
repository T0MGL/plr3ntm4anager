// @ts-nocheck
import React, { useState, useEffect } from "react";
import { IoLocationOutline } from "react-icons/io5";
import { StorageService } from "../../../../services/storageService";

const Step1Location1 = ({ onValidityChange, onDataChange }) => {
  const [address, setAddress] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await StorageService.getItem("step 1 host");
        if (saved?.location) {
          setAddress(saved.location.street || saved.location.fullAddress || "");
          setUnitNumber(saved.location.unitNumber || "");
          setNeighborhood(saved.location.neighborhood || "");
          setGoogleMapsUrl(saved.location.googleMapsUrl || "");
        }
      } catch (err) {
        console.error("Failed to restore location:", err);
      }
    };
    void restore();
  }, []);

  useEffect(() => {
    const nextErrors: Record<string, string> = {};
    if (!address.trim()) nextErrors.address = "La direccion es obligatoria.";
    if (googleMapsUrl.trim() && !googleMapsUrl.includes("google") && !googleMapsUrl.includes("goo.gl") && !googleMapsUrl.includes("maps")) {
      nextErrors.googleMapsUrl = "Ingresa un link valido de Google Maps.";
    }
    setErrors(nextErrors);

    const isValid = !!address.trim() && Object.keys(nextErrors).length === 0;
    onValidityChange?.(isValid);

    const coords = extractCoordsFromUrl(googleMapsUrl);

    const locationData = {
      street: address.trim(),
      unitNumber: unitNumber.trim(),
      neighborhood: neighborhood.trim(),
      googleMapsUrl: googleMapsUrl.trim(),
      fullAddress: [address.trim(), unitNumber.trim(), neighborhood.trim()].filter(Boolean).join(", "),
      city: "Asuncion",
      state: "Central",
      country: "Paraguay",
      countryCode: "PY",
      lat: coords?.lat ?? null,
      lon: coords?.lng ?? null,
      manualEntry: true,
    };

    onDataChange?.({
      "step 1 host": { location: locationData },
    });
  }, [address, unitNumber, neighborhood, googleMapsUrl, onValidityChange, onDataChange]);

  return (
    <div className="flex h-full w-full flex-col items-center pb-4 md:px-4">
      <div className="mb-6 w-full max-w-2xl text-left">
        <h1 className="text-2xl font-semibold text-[#222222]">
          Ubicacion de la unidad
        </h1>
        <p className="mt-2 text-[15px] font-normal text-[#6A6A6A]">
          Todas las unidades son en Paraguay. La direccion se comparte con el huesped despues de la reserva.
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#222222]">
            Direccion
          </label>
          <div className="flex items-center rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:border-[#222222] transition-colors">
            <IoLocationOutline className="mr-3 text-xl text-[#6A6A6A]" />
            <input
              type="text"
              placeholder="Ej: Av. Mariscal Lopez 3456"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-transparent text-[15px] text-[#222222] placeholder-[#aaa] focus:outline-none"
            />
          </div>
          {errors.address && (
            <p className="mt-1.5 text-[13px] text-red-500">{errors.address}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#222222]">
              Numero de unidad
            </label>
            <input
              type="text"
              placeholder="Ej: Piso 7, Depto 702"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-[#222222] shadow-sm placeholder-[#aaa] focus:border-[#222222] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#222222]">
              Barrio
            </label>
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-[#222222] shadow-sm focus:border-[#222222] focus:outline-none transition-colors"
            >
              <option value="">Seleccionar barrio</option>
              <option value="Villa Morra">Villa Morra</option>
              <option value="Recoleta">Recoleta</option>
              <option value="Las Mercedes">Las Mercedes</option>
              <option value="Centro">Centro</option>
              <option value="Aeropuerto">Aeropuerto</option>
              <option value="Carmelitas">Carmelitas</option>
              <option value="Manora">Manora</option>
              <option value="Santa Teresa">Santa Teresa</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#222222]">
            Link de Google Maps
          </label>
          <input
            type="url"
            placeholder="https://maps.google.com/..."
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-[#222222] shadow-sm placeholder-[#aaa] focus:border-[#222222] focus:outline-none transition-colors"
          />
          {errors.googleMapsUrl && (
            <p className="mt-1.5 text-[13px] text-red-500">{errors.googleMapsUrl}</p>
          )}
          <p className="mt-1.5 text-xs text-[#6A6A6A]">
            Busca la ubicacion en Google Maps, copia el link de compartir y pegalo aqui.
          </p>
        </div>
      </div>
    </div>
  );
};

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  return null;
}

export default Step1Location1;
