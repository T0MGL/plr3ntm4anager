// @ts-nocheck
import React, { useState, useEffect } from "react";
import { StorageService } from "../../../../services/storageService";
import { motion } from "framer-motion";
import { IoAdd, IoRemove } from "react-icons/io5";

const Counter = ({
  label,
  subLabel,
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 1,
}) => (
  <div className="flex items-center justify-between py-6 border-b border-gray-100 last:border-b-0">
    <div className="flex flex-col gap-1 max-w-[70%]">
      <span className="text-lg text-[#222222] font-medium">{label}</span>
      {subLabel && (
        <span className="text-sm text-gray-500 font-medium leading-tight">
          {subLabel}
        </span>
      )}
    </div>
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => Number(value) > min && onChange(Number(value) - step)}
        className={`w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center transition-all ${Number(value) <= min
          ? "opacity-30 cursor-not-allowed"
          : "hover:border-black active:scale-95"
          }`}
      >
        <IoRemove size={18} />
      </button>
      <span className="text-lg w-8 text-left tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => Number(value) < max && onChange(Number(value) + step)}
        className={`w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center transition-all ${Number(value) >= max
          ? "opacity-30 cursor-not-allowed"
          : "hover:border-black active:scale-95"
          }`}
      >
        <IoAdd size={18} />
      </button>
    </div>
  </div>
);

const Step1BathroomTypes = ({ onValidityChange, onDataChange }) => {
  const [bathrooms, setBathrooms] = useState({
    private: 0,
    dedicated: 0,
    shared: 0,
  });

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await StorageService.getItem("step 1 host");
        if (savedData && savedData.bathrooms) {
          setBathrooms(savedData.bathrooms);
        }
      } catch (err) {
        console.error("Failed to load bathroom data:", err);
      }
    };
    loadSavedData();
  }, []);

  useEffect(() => {
    onValidityChange?.(true);

    onDataChange?.({
      "step 1 host": {
        bathrooms: bathrooms,
      },
    });
  }, [bathrooms, onValidityChange, onDataChange]);

  const updateCount = (key, val) => {
    setBathrooms((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="max-w-xl w-full mx-auto pb-32 pt-0 md:px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-semibold text-[#222222] mb-6">
          What kind of bathrooms are available to guests?
        </h1>

        <div className="flex flex-col mb-10">
          <Counter
            label="Private and attached"
            subLabel="It's connected to the guest's room and is just for them."
            value={bathrooms.private}
            onChange={(v) => updateCount("private", v)}
          />
          <Counter
            label="Dedicated"
            subLabel="It's private, but accessed via a shared space, like a hallway."
            value={bathrooms.dedicated}
            onChange={(v) => updateCount("dedicated", v)}
          />
          <Counter
            label="Shared"
            subLabel="It's shared with other people."
            value={bathrooms.shared}
            onChange={(v) => updateCount("shared", v)}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default Step1BathroomTypes;
