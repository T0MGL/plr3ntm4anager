// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiChevronDown, HiSearch } from "react-icons/hi";
import axios from "axios";
import { StorageService } from "../../../../services/storageService";
import toast from "react-hot-toast";

const FinalDetail = ({ onValidityChange, onDataChange }) => {
  const [countries, setCountries] = useState([]);
  const [formData, setFormData] = useState({
    country: "",
    countryCode: "",
    street: "",
    apt: "",
    city: "",
    state: "",
    zip: "",
    aptType: "Apartment Number",
  });
  const [isBusiness, setIsBusiness] = useState(null);

  // Country Dropdown state
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [isAptActive, setIsAptActive] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch Countries on Mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await axios.get(
          "https://restcountries.com/v3.1/all?fields=name,cca2",
        );
        const sortedCountries = response.data
          .map((c) => ({
            name: c.name.common,
            code: c.cca2,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(sortedCountries);

        // Load saved data after countries are fetched
        const savedData = await StorageService.getItem("step 3 final detail");
        if (savedData) {
          setFormData({
            country: savedData.country || "",
            countryCode: savedData.countryCode || "",
            street: savedData.street || "",
            apt: savedData.apt || "",
            city: savedData.city || "",
            state: savedData.state || "",
            zip: savedData.zip || "",
            aptType: savedData.aptType || "Apartment Number",
          });
          if (savedData.isBusiness !== undefined) {
            setIsBusiness(savedData.isBusiness);
          }
        }
      } catch (err) {
        console.error("Failed to load component data:", err);
      }
    };
    fetchCountries();
  }, []);

  // Get StorageService import at top

  // Clear state/city when country changes
  useEffect(() => {
    if (formData.country) {
      // Optional: Reset state/city on country change if desired, strictly not required for manual input
      // setFormData(prev => ({ ...prev, state: '', city: '' }));
    }
  }, [formData.country]);

  const handleCountrySelect = (c) => {
    setFormData((prev) => ({
      ...prev,
      country: c.name,
      countryCode: c.code,
      // We can choose to reset other fields or keep them. keeping them might be annoying if accidental click.
      // Let's reset purely location fields potentially, but maybe safer to keep manual inputs?
      // The previous logic reset them. Let's reset them to be safe.
      state: "",
      city: "",
      street: "",
      zip: "",
      apt: "",
    }));
    setCountrySearch("");
    setShowCountryDropdown(false);
  };

  useEffect(() => {
    const isValid =
      formData.country &&
      formData.street &&
      formData.city &&
      isBusiness !== null;
    onValidityChange?.(isValid);
    onDataChange?.({
      "step 3 final detail": {
        ...formData,
        isBusiness,
      },
    });
  }, [formData, isBusiness]);

  // Click outside handling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  return (
    <div className="w-full max-w-2xl mx-auto md:px-6 py-10 flex flex-col text-left">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-semibold text-secondary tracking-tight">
          Provide a few final details
        </h1>
      </motion.div>

      <div className="space-y-6 mb-12">
        <div>
          <h2 className="text-[18px] font-semibold text-secondary mb-1">
            What's your residential address?
          </h2>
          <p className="text-[14px] text-forth mb-6 font-normal">
            Guests won't see this information.
          </p>
        </div>

        <div
          className="border border-[#B0B0B0] rounded-xl overflow-visible shadow-sm bg-white"
          ref={dropdownRef}
        >
          {/* Country Selection */}
          <div className="relative border-b border-[#B0B0B0]">
            <div
              className="p-4 cursor-pointer flex items-center justify-between"
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
            >
              <div>
                <label className="text-[12px] text-forth font-normal">
                  Country / region
                </label>
                <div className="text-[16px] text-secondary min-h-[24px]">
                  {formData.country || "Select region"}
                </div>
              </div>
              <HiChevronDown
                className={`text-xl text-secondary transition-transform ${showCountryDropdown ? "rotate-180" : ""}`}
              />
            </div>

            <AnimatePresence>
              {showCountryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#B0B0B0] shadow-xl rounded-xl z-[50] overflow-hidden flex flex-col max-h-[300px]"
                >
                  <div className="p-3 border-b border-gray-100 sticky top-0 bg-white">
                    <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2">
                      <HiSearch className="text-gray-400 mr-2" />
                      <input
                        type="text"
                        placeholder="Search countries..."
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="bg-transparent border-none outline-none text-[14px] w-full"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto">
                    {filteredCountries.map((c) => (
                      <div
                        key={c.code}
                        onClick={() => handleCountrySelect(c)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-[15px] text-secondary"
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Street Address */}
          <div className="relative border-b border-[#B0B0B0]">
            <div className={`p-4 ${!formData.country ? "opacity-50" : ""}`}>
              <label className="text-[12px] text-forth font-normal block">
                Street address
              </label>
              <input
                type="text"
                value={formData.street}
                disabled={!formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, street: e.target.value }))
                }
                placeholder="Street address"
                className="w-full text-[16px] text-secondary outline-none bg-transparent font-normal mt-1"
              />
            </div>
          </div>

          {/* Apt, Floor, Bldg */}
          <div className="border-b border-[#B0B0B0] p-4">
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
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${formData.aptType === type ? "bg-secondary text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
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
              value={formData.apt}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, apt: e.target.value }))
              }
              onFocus={() => setIsAptActive(true)}
              placeholder="Apt, floor, bldg (if applicable)"
              className="w-full text-[16px] text-secondary outline-none bg-transparent font-normal"
            />
          </div>

          {/* State Selection - Manual Input */}
          <div className="relative border-b border-[#B0B0B0]">
            <div
              className={`p-4 ${!formData.country ? "bg-gray-50 cursor-not-allowed" : ""}`}
            >
              <label className="text-[12px] text-forth font-normal block mb-1">
                Province / state / territory (if applicable)
              </label>
              <input
                type="text"
                value={formData.state}
                disabled={!formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, state: e.target.value }))
                }
                placeholder="Enter state / province"
                className="w-full text-[16px] text-secondary outline-none bg-transparent font-normal"
              />
            </div>
          </div>

          {/* City Selection - Manual Input */}
          <div className="relative border-b border-[#B0B0B0]">
            <div
              className={`p-4 ${!formData.country ? "bg-gray-50 cursor-not-allowed" : ""}`}
            >
              <label className="text-[12px] text-forth font-normal block mb-1">
                City / town / village
              </label>
              <input
                type="text"
                value={formData.city}
                disabled={!formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, city: e.target.value }))
                }
                placeholder="Enter city"
                className="w-full text-[16px] text-secondary outline-none bg-transparent font-normal"
              />
            </div>
          </div>

          {/* Postal Code */}
          <div className="p-4">
            <label className="text-[12px] text-forth font-normal block">
              Postal code (if applicable)
            </label>
            <input
              type="text"
              value={formData.zip}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, zip: e.target.value }))
              }
              placeholder="Postal code (if applicable)"
              className="w-full text-[16px] text-secondary outline-none bg-transparent font-normal mt-1"
            />
          </div>
        </div>
      </div>

      <div className="w-full h-[2px] bg-[#EBEBEB] mb-12 shrink-0" />

      {/* Business Question */}
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-semibold text-secondary mb-1">
            Are you hosting as a business?
          </h2>
          <p className="text-[14px] text-forth font-normal">
            This means your business is most likely registered with your state
            or government.{" "}
            <span className=" font-semibold text-secondary cursor-pointer">
              Get details
            </span>
          </p>
        </div>

        <div className="flex gap-4 ">
          <button
            onClick={() => setIsBusiness(true)}
            className={`flex-1 py-4 border-2 rounded-xl text-lg font-semibold transition-all ${
              isBusiness === true
                ? "border-secondary bg-gray-50"
                : "border-[#EBEBEB] hover:border-secondary/30"
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => setIsBusiness(false)}
            className={`flex-1 py-4 border-2 rounded-xl text-lg font-semibold transition-all ${
              isBusiness === false
                ? "border-secondary bg-gray-50"
                : "border-[#EBEBEB] hover:border-secondary/30"
            }`}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalDetail;
