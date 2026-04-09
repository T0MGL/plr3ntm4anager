// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { IoLocationOutline } from "react-icons/io5";
import axios from "axios";
import "leaflet/dist/leaflet.css";
import { StorageService } from "../../../../services/storageService";

const mapBounds = [
  [-90, -180],
  [90, 180],
];

const Step1Location1 = ({ onValidityChange, onDataChange }) => {
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [countriesGeoJSON, setCountriesGeoJSON] = useState(null);
  const [highlightedCountryCode, setHighlightedCountryCode] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [isTouched, setIsTouched] = useState(false);

  const searchRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isPasteRef = useRef(false);

  useEffect(() => {
    axios
      .get(
        "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json",
      )
      .then((res) => setCountriesGeoJSON(res.data))
      .catch((err) => console.error("Failed to load countries GeoJSON", err));
  }, []);

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await StorageService.getItem("step 1 host");
        if (saved?.location) {
          setAddress(saved.location.fullAddress || "");
          setSelectedAddress(saved.location);
          if (saved.location.countryCode) {
            setHighlightedCountryCode(saved.location.countryCode.toUpperCase());
          }
        }
      } catch (err) {
        console.error("Failed to restore location:", err);
      }
    };
    void restore();
  }, []);

  useEffect(() => {
    const hasCountry = !!selectedAddress?.country;
    const hasCoordinates =
      selectedAddress?.lat !== undefined &&
      selectedAddress?.lat !== null &&
      selectedAddress?.lon !== undefined &&
      selectedAddress?.lon !== null;
    const hasManualAddress = !!(
      selectedAddress?.street || selectedAddress?.fullAddress
    );
    const isValid =
      !!selectedAddress && hasCountry && (hasCoordinates || hasManualAddress);
    onValidityChange?.(isValid);

    let currentError = "";
    if (isTouched) {
      if (address.length > 0 && !selectedAddress) {
        currentError = "Please select an address from the suggestions";
      } else if (selectedAddress && !selectedAddress.country) {
        currentError = "Country is required";
      }
    }
    setError(currentError);

    if (selectedAddress) {
      const { city, state, country, postcode } = selectedAddress;
      const parts = [city, state, country, postcode].filter(Boolean);
      const combined =
        parts.length > 0 ? parts.join(", ") : selectedAddress.fullAddress;

      onDataChange?.({
        "step 1 host": {
          location: {
            ...selectedAddress,
            fullAddress: combined,
            city: city || "",
            state: state || "",
            country: country || "",
            zipCode: postcode || "",
            manualEntry: false,
          },
        },
      });
    }
  }, [selectedAddress, address, isTouched, onValidityChange, onDataChange]);

  const cleanAddressInput = (input) =>
    input
      .replace(/^(?:suite|apt|unit|floor|room)\s+#?\w+[\s,]+/i, "")
      .replace(/,\s*(?:suite|apt|unit|floor|room)\s+#?\w+/gi, "")
      .replace(/\s+#\w+/g, "")
      .trim();

  const mapPhotonResultToAddress = (feature) => {
    const props = feature.properties;
    const coords = feature.geometry.coordinates;
    const countryCode = props.countrycode?.toUpperCase();

    const name = props.name || "";
    const street = props.street || "";
    let fullAddr = name;
    if (street && name !== street) fullAddr += `, ${street}`;
    if (props.city) fullAddr += `, ${props.city}`;
    else if (props.town) fullAddr += `, ${props.town}`;
    else if (props.village) fullAddr += `, ${props.village}`;
    if (props.state) fullAddr += `, ${props.state}`;
    if (props.postcode) fullAddr += `, ${props.postcode}`;
    if (props.country) fullAddr += `, ${props.country}`;

    return {
      fullAddress: fullAddr,
      street: street || name || "",
      city: props.city || props.town || props.village || props.county || "",
      state: props.state || "",
      country: props.country || "",
      countryCode,
      postcode: props.postcode || "",
      lat: coords[1],
      lon: coords[0],
    };
  };

  const handleSearch = (val) => {
    setAddress(val);
    setSelectedAddress(null);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!val || val.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      try {
        const cleanedVal = cleanAddressInput(val);
        const res = await axios.get("https://photon.komoot.io/api/", {
          params: { q: cleanedVal, limit: 6, lang: "en" },
          signal: abortControllerRef.current.signal,
        });

        const mappedSuggestions = (res.data.features || []).map((f) => {
          const mapped = mapPhotonResultToAddress(f);
          return {
            ...f,
            display_name: mapped.fullAddress,
            address: {
              road: mapped.street,
              city: mapped.city,
              state: mapped.state,
              country: mapped.country,
              postcode: mapped.postcode,
              country_code: mapped.countryCode,
            },
            mappedObject: mapped,
          };
        });

        setSuggestions(mappedSuggestions);

        if (isPasteRef.current && mappedSuggestions.length > 0) {
          const finalSelection = mappedSuggestions[0].mappedObject;
          setSelectedAddress(finalSelection);
          if (finalSelection.countryCode)
            setHighlightedCountryCode(finalSelection.countryCode);
          setShowSuggestions(false);
          isPasteRef.current = false;
          return;
        }

        setShowSuggestions(mappedSuggestions.length > 0);
      } catch (err) {
        if (!axios.isCancel(err)) console.error("Search failed", err);
      }
    }, 450);
  };

  const selectSuggestion = (sug) => {
    const mapped = sug.mappedObject || mapPhotonResultToAddress(sug);
    setAddress(mapped.fullAddress);
    setSelectedAddress(mapped);
    if (mapped.countryCode) setHighlightedCountryCode(mapped.countryCode);
    setShowSuggestions(false);
    setIsTouched(false);
    setError("");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const countryStyle = (feature) => {
    const countryCode = feature.properties.ISO_A2 || feature.properties.iso_a2;
    const isHighlighted = countryCode === highlightedCountryCode;

    const colors = [
      "#A3D9A5",
      "#F9E79F",
      "#F5CBA7",
      "#F1948A",
      "#AED6F1",
      "#D2B4DE",
      "#A2D9CE",
    ];
    const name = feature.properties.NAME || "";
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const color = colors[Math.abs(hash) % colors.length];

    return {
      fillColor: isHighlighted ? "#A1642E" : color,
      weight: 0.5,
      opacity: 1,
      color: "#ffffff",
      fillOpacity: isHighlighted ? 0.9 : 0.8,
    };
  };

  return (
    <div className="flex h-full w-full flex-col items-center pb-4 md:px-4">
      <div className="mb-3 w-full max-w-4xl text-left">
        <h1 className="text-2xl font-semibold text-[#222222]">
          Where's your place located?
        </h1>
        <p className="mt-2 text-[15px] font-normal text-[#6A6A6A]">
          Your address is only shared with guests after they've made a
          reservation.
        </p>
      </div>

      <div className="relative h-[600px] w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-100 shadow-lg md:h-[740px]">
        <div className="absolute inset-0 z-0 bg-[#AAD3DF]">
          <MapContainer
            center={[20, 10]}
            zoom={1.8}
            minZoom={1.5}
            maxBounds={mapBounds}
            maxBoundsViscosity={1.0}
            worldCopyJump={false}
            zoomSnap={0.1}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
            dragging={false}
            touchZoom={false}
            doubleClickZoom={false}
            scrollWheelZoom={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
              noWrap
              bounds={mapBounds}
            />
            {countriesGeoJSON && (
              <GeoJSON
                key={highlightedCountryCode || "none"}
                data={countriesGeoJSON}
                style={countryStyle}
              />
            )}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              noWrap
              bounds={mapBounds}
            />
          </MapContainer>
        </div>

        <div
          className="absolute left-1/2 top-6 z-50 w-full max-w-2xl -translate-x-1/2 px-6"
          ref={searchRef}
        >
          <div className="relative">
            <div className="flex items-center rounded-full border border-gray-200 bg-white px-5 py-3.5 shadow-lg">
              <IoLocationOutline className="mr-3 text-xl text-[#222222]" />
              <input
                type="text"
                placeholder="Enter Address..."
                value={address}
                onChange={(e) => handleSearch(e.target.value)}
                onPaste={() => {
                  isPasteRef.current = true;
                }}
                onBlur={() => {
                  setIsTouched(true);
                  if (selectedAddress) setAddress(selectedAddress.fullAddress);
                }}
                autoComplete="off"
                className="w-full bg-transparent text-base font-normal text-[#222222] focus:outline-none"
              />
            </div>

            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute mt-2 max-h-[350px] w-full overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-2xl"
                >
                  {suggestions.map((sug, idx) => (
                    <div
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(sug);
                      }}
                      className="flex cursor-pointer flex-col border-b border-gray-100 px-5 py-4 text-left transition-colors last:border-0 hover:bg-gray-50"
                    >
                      <span className="mb-1 text-[14px] font-semibold leading-tight text-[#222222]">
                        {sug.display_name}
                      </span>
                      <div className="flex flex-wrap gap-x-2 text-[12px] text-[#717171]">
                        {sug.address.road && <span>{sug.address.road},</span>}
                        {sug.address.city && <span>{sug.address.city},</span>}
                        {sug.address.state && <span>{sug.address.state},</span>}
                        {sug.address.postcode && (
                          <span className="font-medium text-[#1e3a8a]">
                            ZIP: {sug.address.postcode},
                          </span>
                        )}
                        <span>{sug.address.country}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-3 flex items-center rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-600 shadow-sm"
                >
                  <div className="mr-2 h-1.5 w-1.5 rounded-full bg-red-500" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1Location1;
