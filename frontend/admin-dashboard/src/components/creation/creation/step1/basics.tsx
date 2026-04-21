// @ts-nocheck
import React, { useState, useEffect } from "react";
import { StorageService } from "../../../../services/storageService";
import { motion } from "framer-motion";
import { IoAdd, IoRemove } from "react-icons/io5";

const Counter = ({ label, value, onChange, min = 0 }) => (
  <div className="flex items-center justify-between border-b border-gray-100 py-4 last:border-b-0">
    <span className="text-lg font-normal text-[#222222]">{label}</span>
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => value > min && onChange(value - 1)}
        className={`flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 transition-all ${
          value <= min
            ? "cursor-not-allowed opacity-30"
            : "active:scale-95 hover:border-black"
        }`}
      >
        <IoRemove size={18} />
      </button>
      <span className="w-6 text-left text-lg tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 transition-all hover:border-black active:scale-95"
      >
        <IoAdd size={18} />
      </button>
    </div>
  </div>
);

const Step1Basics = ({ onValidityChange, onDataChange }) => {
  const [basics, setBasics] = useState({
    guests: 1,
    bedrooms: 0,
    beds: 0,
    hasLock: null,
  });

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await StorageService.getItem("step 1 host");
        const savedBasics = savedData?.basics || savedData?.["hotel basics"];
        if (savedBasics) {
          setBasics({
            guests: Number(savedBasics.guests || 1),
            bedrooms: Number(savedBasics.bedrooms || 0),
            beds: Number(savedBasics.beds || 0),
            hasLock: savedBasics.hasLock ?? null,
          });
        }
      } catch (err) {
        console.error("Failed to load basics data from SQLite:", err);
      }
    };
    void loadSavedData();
  }, []);

  useEffect(() => {
    const isValid = basics.guests >= 1 && basics.hasLock !== null;
    onValidityChange?.(isValid);

    onDataChange?.({
      "step 1 host": {
        basics,
        "hotel basics": basics,
      },
    });
  }, [basics, onValidityChange, onDataChange]);

  return (
    <div className="mx-auto w-full max-w-xl py-2 md:px-4 md:py-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="mb-4 text-2xl font-semibold text-[#222222]">
          Capacidad y configuracion
        </h1>

        <div className="mb-8">
          <h2 className="mb-4 text-md font-medium text-[#222222]">
            Capacidad maxima de la unidad
          </h2>
          <div className="flex flex-col">
            <Counter
              label="Huespedes"
              value={basics.guests}
              onChange={(v) => setBasics((prev) => ({ ...prev, guests: v }))}
              min={1}
            />
            <Counter
              label="Habitaciones"
              value={basics.bedrooms}
              onChange={(v) => setBasics((prev) => ({ ...prev, bedrooms: v }))}
            />
            <Counter
              label="Camas"
              value={basics.beds}
              onChange={(v) => setBasics((prev) => ({ ...prev, beds: v }))}
            />
          </div>
        </div>

        <div>
          <h2 className="mb-6 text-md font-medium text-[#222222]">
            ¿Todas las habitaciones tienen cerradura?
          </h2>

          <div className="space-y-4">
            <label className="group flex cursor-pointer items-center gap-4">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="hasLock"
                  checked={basics.hasLock === true}
                  onChange={() =>
                    setBasics((prev) => ({ ...prev, hasLock: true }))
                  }
                  className="h-6 w-6 cursor-pointer appearance-none rounded-full border-2 border-gray-300 transition-all checked:border-black"
                />
                {basics.hasLock === true && (
                  <div className="absolute h-3 w-3 rounded-full bg-black" />
                )}
              </div>
              <span className="text-lg text-[#222222]">Si</span>
            </label>

            <label className="group flex cursor-pointer items-start gap-4">
              <div className="relative mt-1 flex items-center justify-center">
                <input
                  type="radio"
                  name="hasLock"
                  checked={basics.hasLock === false}
                  onChange={() =>
                    setBasics((prev) => ({ ...prev, hasLock: false }))
                  }
                  className="h-6 w-6 cursor-pointer appearance-none rounded-full border-2 border-gray-300 transition-all checked:border-black"
                />
                {basics.hasLock === false && (
                  <div className="absolute h-3 w-3 rounded-full bg-black" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-lg text-[#222222]">No</span>
                <p className="mt-1 max-w-full text-sm leading-relaxed text-gray-500">
                  Guests expect a lock for their room. We strongly recommend
                  adding one.
                </p>
              </div>
            </label>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Step1Basics;
