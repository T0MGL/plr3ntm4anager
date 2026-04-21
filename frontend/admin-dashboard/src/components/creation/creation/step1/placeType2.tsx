// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";

const OPTIONS = [
  {
    id: "entire_place",
    title: "Unidad completa",
    loading: "lazy",
    description: "El huesped ocupa la unidad completa durante su estadia.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8">
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    id: "room",
    title: "Habitacion privada",
    loading: "lazy",
    description: "El huesped tiene habitacion privada con acceso a espacios comunes.",
    icon: (
      <img
        src="https://res.cloudinary.com/di9tb45rl/image/upload/v1769541481/Container_gwglcz.png"
        alt="door"
      />
    ),
  },
  {
    id: "shared_room",
    title: "Habitacion compartida",
    loading: "lazy",
    description: "El huesped comparte habitacion con otros huespedes.",
    icon: (
      <img
        src="https://res.cloudinary.com/di9tb45rl/image/upload/v1769541481/Container_1_artjue.png"
        alt="door"
      />
    ),
  },
];

const Step1PlaceType2 = ({ onValidityChange, onDataChange }) => {
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await StorageService.getItem("step 1 host");
        if (saved && saved.guestPlaceType) {
          const id =
            typeof saved.guestPlaceType === "object"
              ? saved.guestPlaceType.id
              : saved.guestPlaceType;
          if (id) setSelectedId(id);
        }
      } catch (err) {
        console.error("Failed to restore guestPlaceType:", err);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    onValidityChange?.(selectedId !== null);
    if (selectedId) {
      const selectedOption = OPTIONS.find((opt) => opt.id === selectedId);
      if (selectedOption) {
        onDataChange?.({
          "step 1 host": {
            guestPlaceType: {
              id: selectedOption.id,
              title: selectedOption.title,
              description: selectedOption.description,
            },
          },
        });
      }
    }
  }, [selectedId, onValidityChange, onDataChange]);

  return (
    <div className="w-full h-full flex flex-col items-center">
      <div className="w-full max-w-2xl px-4">
        <h1 className="text-2xl font-semibold text-[#222222] mb-4 text-left">
          Espacio ocupado por el huesped
        </h1>
      </div>

      <div className="w-full max-w-2xl space-y-4 px-4 overflow-y-auto no-scrollbar pb-10 pt-1">
        {OPTIONS.map((option) => (
          <motion.button
            key={option.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSelectedId(option.id)}
            className={`w-full flex items-center justify-between p-6 rounded-2xl border-2 transition-all text-left ${
              selectedId === option.id
                ? "bg-[#F7F7F7] border-primary ring-0"
                : "bg-white border-gray-200 hover:border-primary"
            }`}
          >
            <div className="flex-1 pr-4">
              <h3 className="text-base font-semibold text-[#222222]">
                {option.title}
              </h3>
              <p className="text-[#6A6A6A] text-sm mt-1 w-full max-w-96 leading-relaxed">
                {option.description}
              </p>
            </div>
            <div className="text-[#222222] flex-shrink-0 w-9 h-9">
              {option.icon}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default Step1PlaceType2;
