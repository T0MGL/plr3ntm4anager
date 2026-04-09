// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  GeoJSON,
  useMap,
} from "react-leaflet";
import { IoChevronDown, IoHome, IoSearchOutline } from "react-icons/io5";
import L from "leaflet";
import axios from "axios";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";
import { StorageService } from "../../../../services/storageService";

// Custom Marker Icon: Brown circle with Home icon
const houseMarkerHtml = `
  <div style="
    background-color: #A1642E;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border: 3px solid white;
    line-height: 0;
  ">
    <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="26" width="26" xmlns="http://www.w3.org/2000/svg" style="margin-top: -2px;">
      <path d="M261.56 101.28a8 8 0 00-11.12 0L34.22 305.82a8 8 0 005.66 13.65H80v153.1a16 16 0 0016 16h112a16 16 0 0016-16V336a8 8 0 018-8h56a8 8 0 018 8v136.57a16 16 0 0016 16h112a16 16 0 0016-16V319.47h40.12a8 8 0 005.66-13.65z"></path>
    </svg>
  </div>
`;

const houseIcon = L.divIcon({
  html: houseMarkerHtml,
  className: "custom-house-icon",
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const mapBounds = [
  [-90, -180],
  [90, 180],
];

const allCountries = [
  { name: "Afghanistan", code: "AF" },
  { name: "Albania", code: "AL" },
  { name: "Algeria", code: "DZ" },
  { name: "Andorra", code: "AD" },
  { name: "Angola", code: "AO" },
  { name: "Argentina", code: "AR" },
  { name: "Armenia", code: "AM" },
  { name: "Australia", code: "AU" },
  { name: "Austria", code: "AT" },
  { name: "Azerbaijan", code: "AZ" },
  { name: "Bahamas", code: "BS" },
  { name: "Bahrain", code: "BH" },
  { name: "Bangladesh", code: "BD" },
  { name: "Barbados", code: "BB" },
  { name: "Belarus", code: "BY" },
  { name: "Belgium", code: "BE" },
  { name: "Belize", code: "BZ" },
  { name: "Benin", code: "BJ" },
  { name: "Bhutan", code: "BT" },
  { name: "Bolivia", code: "BO" },
  { name: "Bosnia and Herzegovina", code: "BA" },
  { name: "Botswana", code: "BW" },
  { name: "Brazil", code: "BR" },
  { name: "Brunei", code: "BN" },
  { name: "Bulgaria", code: "BG" },
  { name: "Burkina Faso", code: "BF" },
  { name: "Burundi", code: "BI" },
  { name: "Cambodia", code: "KH" },
  { name: "Cameroon", code: "CM" },
  { name: "Canada", code: "CA" },
  { name: "Cape Verde", code: "CV" },
  { name: "Central African Republic", code: "CF" },
  { name: "Chad", code: "TD" },
  { name: "Chile", code: "CL" },
  { name: "China", code: "CN" },
  { name: "Colombia", code: "CO" },
  { name: "Comoros", code: "KM" },
  { name: "Congo", code: "CG" },
  { name: "Costa Rica", code: "CR" },
  { name: "Croatia", code: "HR" },
  { name: "Cuba", code: "CU" },
  { name: "Cyprus", code: "CY" },
  { name: "Czech Republic", code: "CZ" },
  { name: "Denmark", code: "DK" },
  { name: "Djibouti", code: "DJ" },
  { name: "Dominica", code: "DM" },
  { name: "Dominican Republic", code: "DO" },
  { name: "Ecuador", code: "EC" },
  { name: "Egypt", code: "EG" },
  { name: "El Salvador", code: "SV" },
  { name: "Equatorial Guinea", code: "GQ" },
  { name: "Eritrea", code: "ER" },
  { name: "Estonia", code: "EE" },
  { name: "Ethiopia", code: "ET" },
  { name: "Fiji", code: "FJ" },
  { name: "Finland", code: "FI" },
  { name: "France", code: "FR" },
  { name: "Gabon", code: "GA" },
  { name: "Gambia", code: "GM" },
  { name: "Georgia", code: "GE" },
  { name: "Germany", code: "DE" },
  { name: "Ghana", code: "GH" },
  { name: "Greece", code: "GR" },
  { name: "Grenada", code: "GD" },
  { name: "Guatemala", code: "GT" },
  { name: "Guinea", code: "GN" },
  { name: "Guinea-Bissau", code: "GW" },
  { name: "Guyana", code: "GY" },
  { name: "Haiti", code: "HT" },
  { name: "Honduras", code: "HN" },
  { name: "Hungary", code: "HU" },
  { name: "Iceland", code: "IS" },
  { name: "India", code: "IN" },
  { name: "Indonesia", code: "ID" },
  { name: "Iran", code: "IR" },
  { name: "Iraq", code: "IQ" },
  { name: "Ireland", code: "IE" },
  { name: "Israel", code: "IL" },
  { name: "Italy", code: "IT" },
  { name: "Jamaica", code: "JM" },
  { name: "Japan", code: "JP" },
  { name: "Jordan", code: "JO" },
  { name: "Kazakhstan", code: "KZ" },
  { name: "Kenya", code: "KE" },
  { name: "Kiribati", code: "KI" },
  { name: "Korea (North)", code: "KP" },
  { name: "Korea (South)", code: "KR" },
  { name: "Kuwait", code: "KW" },
  { name: "Kyrgyzstan", code: "KG" },
  { name: "Laos", code: "LA" },
  { name: "Latvia", code: "LV" },
  { name: "Lebanon", code: "LB" },
  { name: "Lesotho", code: "LS" },
  { name: "Liberia", code: "LR" },
  { name: "Libya", code: "LY" },
  { name: "Liechtenstein", code: "LI" },
  { name: "Lithuania", code: "LT" },
  { name: "Luxembourg", code: "LU" },
  { name: "Macedonia", code: "MK" },
  { name: "Madagascar", code: "MG" },
  { name: "Malawi", code: "MW" },
  { name: "Malaysia", code: "MY" },
  { name: "Maldives", code: "MV" },
  { name: "Mali", code: "ML" },
  { name: "Malta", code: "MT" },
  { name: "Marshall Islands", code: "MH" },
  { name: "Mauritania", code: "MR" },
  { name: "Mauritius", code: "MU" },
  { name: "Mexico", code: "MX" },
  { name: "Micronesia", code: "FM" },
  { name: "Moldova", code: "MD" },
  { name: "Monaco", code: "MC" },
  { name: "Mongolia", code: "MN" },
  { name: "Montenegro", code: "ME" },
  { name: "Morocco", code: "MA" },
  { name: "Mozambique", code: "MZ" },
  { name: "Myanmar", code: "MM" },
  { name: "Namibia", code: "NA" },
  { name: "Nauru", code: "NR" },
  { name: "Nepal", code: "NP" },
  { name: "Netherlands", code: "NL" },
  { name: "New Zealand", code: "NZ" },
  { name: "Nicaragua", code: "NI" },
  { name: "Niger", code: "NE" },
  { name: "Nigeria", code: "NG" },
  { name: "Norway", code: "NO" },
  { name: "Oman", code: "OM" },
  { name: "Pakistan", code: "PK" },
  { name: "Palau", code: "PW" },
  { name: "Panama", code: "PA" },
  { name: "Papua New Guinea", code: "PG" },
  { name: "Paraguay", code: "PY" },
  { name: "Peru", code: "PE" },
  { name: "Philippines", code: "PH" },
  { name: "Poland", code: "PL" },
  { name: "Portugal", code: "PT" },
  { name: "Qatar", code: "QA" },
  { name: "Romania", code: "RO" },
  { name: "Russia", code: "RU" },
  { name: "Rwanda", code: "RW" },
  { name: "Saint Kitts and Nevis", code: "KN" },
  { name: "Saint Lucia", code: "LC" },
  { name: "Saint Vincent", code: "VC" },
  { name: "Samoa", code: "WS" },
  { name: "San Marino", code: "SM" },
  { name: "Sao Tome and Principe", code: "ST" },
  { name: "Saudi Arabia", code: "SA" },
  { name: "Senegal", code: "SN" },
  { name: "Serbia", code: "RS" },
  { name: "Seychelles", code: "SC" },
  { name: "Sierra Leone", code: "SL" },
  { name: "Singapore", code: "SG" },
  { name: "Slovakia", code: "SK" },
  { name: "Slovenia", code: "SI" },
  { name: "Solomon Islands", code: "SB" },
  { name: "Somalia", code: "SO" },
  { name: "South Africa", code: "ZA" },
  { name: "South Sudan", code: "SS" },
  { name: "Spain", code: "ES" },
  { name: "Sri Lanka", code: "LK" },
  { name: "Sudan", code: "SD" },
  { name: "Suriname", code: "SR" },
  { name: "Swaziland", code: "SZ" },
  { name: "Sweden", code: "SE" },
  { name: "Switzerland", code: "CH" },
  { name: "Syria", code: "SY" },
  { name: "Taiwan", code: "TW" },
  { name: "Tajikistan", code: "TJ" },
  { name: "Tanzania", code: "TZ" },
  { name: "Thailand", code: "TH" },
  { name: "Togo", code: "TG" },
  { name: "Tonga", code: "TO" },
  { name: "Trinidad and Tobago", code: "TT" },
  { name: "Tunisia", code: "TN" },
  { name: "Turkey", code: "TR" },
  { name: "Turkmenistan", code: "TM" },
  { name: "Tuvalu", code: "TV" },
  { name: "Uganda", code: "UG" },
  { name: "Ukraine", code: "UA" },
  { name: "United Arab Emirates", code: "AE" },
  { name: "United Kingdom", code: "GB" },
  { name: "United States", code: "US" },
  { name: "Uruguay", code: "UY" },
  { name: "Uzbekistan", code: "UZ" },
  { name: "Vanuatu", code: "VU" },
  { name: "Vatican City", code: "VA" },
  { name: "Venezuela", code: "VE" },
  { name: "Vietnam", code: "VN" },
  { name: "Yemen", code: "YE" },
  { name: "Zambia", code: "ZM" },
  { name: "Zimbabwe", code: "ZW" },
];

const Step1LocationConfirm2 = ({ onValidityChange, onDataChange }) => {
  const [formData, setFormData] = useState({
    country: "",
    street: "",
    apt: "",
    city: "",
    state: "",
    zip: "",
    aptType: "Apartment Number",
  });

  const [isAptActive, setIsAptActive] = useState(false);
  const [preciseLocation, setPreciseLocation] = useState(false);
  const [location, setLocation] = useState({ lat: 20, lon: 10 });
  const [loading, setLoading] = useState(true);
  const [countriesGeoJSON, setCountriesGeoJSON] = useState(null);

  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const dropdownRef = React.useRef(null);

  // Fetch GeoJSON for coloring
  useEffect(() => {
    axios
      .get(
        "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json",
      )
      .then((res) => setCountriesGeoJSON(res.data))
      .catch((err) => console.error("Failed to load countries GeoJSON", err));
  }, []);

  // Load from SQLite
  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await StorageService.getItem("step 1 host");
        if (saved && saved.location) {
          setFormData({
            country: saved.location.country || "",
            street: saved.location.street || "",
            apt: saved.location.apt || "",
            city: saved.location.city || "",
            state: saved.location.state || "",
            zip:
              saved.location.zip ||
              saved.location.postcode ||
              saved.location.zipCode ||
              "",
            aptType: saved.location.aptType || "Apartment Number",
          });
          setPreciseLocation(!!saved.location.preciseLocation);
          setLocation({
            lat: parseFloat(saved.location.lat || 20),
            lon: parseFloat(saved.location.lon || 10),
          });
        }
      } catch (err) {
        console.error("Failed to load location data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Map Handler to solve the dragging issue
  const MapEventHandler = () => {
    const map = useMap();
    useEffect(() => {
      if (map) {
        map.dragging.enable();
        map.getContainer().style.cursor = "grab";

        // Ensure events aren't swallowed by any overlapping GeoJSON
        map.on("dragstart", () => {
          map.getContainer().style.cursor = "grabbing";
        });
        map.on("dragend", () => {
          map.getContainer().style.cursor = "grab";
        });
      }
    }, [map]);
    return null;
  };

  // Check validity
  useEffect(() => {
    const isRequiredFilled =
      formData.country && formData.street && formData.city;
    onValidityChange?.(!!isRequiredFilled);

    // Auto-save data change to parent
    if (isRequiredFilled) {
      const fullAddress = `${formData.street}${formData.apt ? ", " + formData.apt : ""}, ${formData.city}, ${formData.state ? formData.state + ", " : ""}${formData.country}`;

      const locationData = {
        ...formData,
        fullAddress,
        preciseLocation,
        updatedAt: new Date().toISOString(),
      };

      // Only add lat/lon if precise location is toggled ON
      if (preciseLocation) {
        locationData.lat = location.lat.toString();
        locationData.lon = location.lon.toString();
      } else {
        // Ensure they are cleared if toggle is off
        locationData.lat = "";
        locationData.lon = "";
      }

      onDataChange?.({
        "step 1 host": {
          location: locationData,
        },
      });
    }
  }, [formData, location, preciseLocation, onValidityChange, onDataChange]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // If user changes any field, turn off precise location
    setPreciseLocation(false);
  };

  const handleCountrySelect = (country) => {
    setFormData({
      country: `${country.name} - ${country.code}`,
      street: "",
      apt: "",
      city: "",
      state: "",
      zip: "",
      aptType: "Apartment Number",
    });
    setPreciseLocation(false);
    setShowCountryDropdown(false);
    setIsAptActive(false);
    setCountrySearch("");
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCountries = allCountries.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  // Close Apt active state on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = async () => {
    if (!preciseLocation) {
      // Individual validation with specific toast errors
      if (!formData.country) {
        toast.error("Country / Region is required to find precise location", {
          style: { background: "#222222", color: "#fff", borderRadius: "10px" },
        });
        return;
      }
      if (!formData.street) {
        toast.error("Street address is required to find precise location", {
          style: { background: "#222222", color: "#fff", borderRadius: "10px" },
        });
        return;
      }
      if (!formData.city) {
        toast.error("City / Town is required to find precise location", {
          style: { background: "#222222", color: "#fff", borderRadius: "10px" },
        });
        return;
      }

      // Fetch precise location
      const geocodeToastId = toast.loading("Finding precise location...");
      try {
        let streetSearch = formData.street;
        if (formData.aptType === "Building Number" && formData.apt) {
          if (!streetSearch.match(/^\d+/)) {
            streetSearch = `${formData.apt} ${streetSearch}`;
          }
        }

        const countryName = formData.country.split(" - ")[0];
        const cleanQuery = `${streetSearch}, ${formData.city}, ${formData.state ? formData.state + ", " : ""}${countryName}`;

        // Switching to Photon API (Komoot). It's faster, free, no token needed, and better for localhost.
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`,
        );

        if (!response.ok) throw new Error("Geocoding service unavailable");

        const data = await response.json();

        if (data && data.features && data.features.length > 0) {
          const [lon, lat] = data.features[0].geometry.coordinates;
          setLocation({ lat, lon });
          setPreciseLocation(true);
          toast.success("Precise location found!", { id: geocodeToastId });
        } else {
          toast.error("Could not find precise coordinates for this address.", {
            id: geocodeToastId,
          });
          setPreciseLocation(false);
        }
      } catch (err) {
        console.error("Geocoding error:", err);
        toast.error(
          "Geocoding failed. Please check your address or try again.",
          { id: geocodeToastId },
        );
        setPreciseLocation(false);
      }
    } else {
      setPreciseLocation(false);
    }
  };

  const countryStyle = (feature) => {
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
      fillColor: color,
      weight: 0.5,
      opacity: 1,
      color: "#ffffff",
      fillOpacity: 0.8,
    };
  };

  if (loading)
    return (
      <div className="w-full flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="w-full max-w-2xl mx-auto md:px-4 py-8 pt-0 overflow-y-auto no-scrollbar h-full">
      <div className="mb-8">
        <h1 className="text-2xl md:text-2xl font-semibold text-[#222222]">
          Confirm your address
        </h1>
        <p className="text-[#6A6A6A] text-[15px] mt-2 font-normal">
          Your address is only shared with guests after they've made a
          reservation.
        </p>
      </div>

      {/* Form Fields */}
      <div className="border border-gray-300 rounded-xl bg-white overflow-visible mb-8">
        <div
          className="relative border-b border-gray-300 transition-colors"
          ref={dropdownRef}
        >
          <div
            className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
          >
            <div>
              <label className="text-[12px] text-gray-500 font-medium block">
                Country / region
              </label>
              <div className="flex items-center justify-between mt-1 min-h-[22px]">
                <span className="text-[15px] text-[#222222]">
                  {formData.country || "Select region"}
                </span>
              </div>
            </div>
            <motion.div
              animate={{ rotate: showCountryDropdown ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <IoChevronDown className="text-gray-400" />
            </motion.div>
          </div>

          <AnimatePresence>
            {showCountryDropdown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 shadow-2xl rounded-2xl z-[1000] overflow-hidden flex flex-col max-h-[250px]"
              >
                <div className="p-3 border-b border-gray-100 bg-white sticky top-0">
                  <div className="flex items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-100 focus-within:border-primary transition-colors">
                    <IoSearchOutline className="text-gray-400 mr-2" />
                    <input
                      type="text"
                      placeholder="Search countries..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      autoFocus
                      className="bg-transparent border-none outline-none text-[14px] w-full"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto no-scrollbar py-2">
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((country) => (
                      <div
                        key={country.code}
                        onClick={() => handleCountrySelect(country)}
                        className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <span className="text-[15px] text-[#222222] font-medium">
                          {country.name}
                        </span>
                        <span className="text-[12px] text-gray-400">
                          {country.code}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-8 text-left text-gray-400 text-[14px]">
                      No countries found.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-b border-gray-300 p-4 transition-colors">
          <label className="text-[12px] text-gray-500 font-medium block">
            Street address
          </label>
          <input
            type="text"
            name="street"
            value={formData.street}
            onChange={handleInputChange}
            placeholder="Street address"
            className="w-full text-[15px] text-[#222222] focus:outline-none bg-transparent mt-1"
          />
        </div>

        <div className="border-b border-gray-300 p-4 transition-colors">
          <AnimatePresence>
            {isAptActive && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 mb-3 overflow-hidden"
              >
                {["Apartment Number", "Floor Number", "Building Number"].map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, aptType: type }))
                      }
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${formData.aptType === type ? "bg-black text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                    >
                      {type}
                    </button>
                  ),
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <input
            type="text"
            name="apt"
            value={formData.apt}
            onChange={handleInputChange}
            onFocus={() => setIsAptActive(true)}
            placeholder="Apt, floor, bldg (if applicable)"
            className="w-full text-[15px] text-[#222222] focus:outline-none bg-transparent"
          />
        </div>

        <div className="border-b border-gray-300 p-4 transition-colors">
          <label className="text-[12px] text-gray-500 font-medium block">
            City / town / village
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            placeholder="City / town / village"
            className="w-full text-[15px] text-[#222222] focus:outline-none bg-transparent mt-1"
          />
        </div>

        <div className="border-b border-gray-300 p-4 transition-colors">
          <label className="text-[12px] text-gray-500 font-medium block">
            Province / state / territory (if applicable)
          </label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleInputChange}
            placeholder="Province / state / territory (if applicable)"
            className="w-full text-[15px] text-[#222222] focus:outline-none bg-transparent mt-1"
          />
        </div>

        <div className="p-4 transition-colors">
          <label className="text-[12px] text-gray-500 font-medium block">
            Postal code (if applicable)
          </label>
          <input
            type="text"
            name="zip"
            value={formData.zip}
            onChange={handleInputChange}
            placeholder="Postal code (if applicable)"
            className="w-full text-[15px] text-[#222222] focus:outline-none bg-transparent mt-1"
          />
        </div>
      </div>

      <hr className="mb-8 border-gray-200" />

      {/* Toggle Section */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="max-w-[80%]">
          <h3 className="text-[16px] font-semibold text-[#222222]">
            Show your home's precise location
          </h3>
          <p className="text-[14px] text-[#6A6A6A] mt-1">
            Make it clear to guests where your place is located. We'll only
            share your address after they've made a reservation.{" "}
            <span className=" font-semibold cursor-pointer">Learn more</span>
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${preciseLocation ? "bg-black" : "bg-[#EBEBEB]"}`}
        >
          <motion.div
            animate={{ x: preciseLocation ? 24 : 2 }}
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
          />
        </button>
      </div>

      {/* Map Section */}
      <div className="w-full h-[300px] mb-12 rounded-2xl overflow-hidden border border-gray-100 shadow-lg relative bg-[#AAD3DF] z-10">
        <MapContainer
          center={[location.lat, location.lon]}
          zoom={preciseLocation ? 14 : 4}
          minZoom={1.5}
          maxBounds={mapBounds}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
          style={{ height: "100%", width: "100%", cursor: "grab" }}
          zoomControl={false}
          dragging={true}
          touchZoom={true}
          doubleClickZoom={true}
          scrollWheelZoom={true}
          attributionControl={false}
        >
          <MapEventHandler />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
            noWrap={true}
            bounds={mapBounds}
          />
          {countriesGeoJSON && (
            <GeoJSON
              data={countriesGeoJSON}
              style={countryStyle}
              interactive={false}
            />
          )}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
            noWrap={true}
            bounds={mapBounds}
          />
          <Marker position={[location.lat, location.lon]} icon={houseIcon}>
            <Tooltip
              permanent={false}
              direction="top"
              offset={[0, -20]}
              className="custom-map-tooltip"
            >
              {preciseLocation
                ? "The precise location will be shared"
                : "We'll share your approximate location."}
            </Tooltip>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default Step1LocationConfirm2;
