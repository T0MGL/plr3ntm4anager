// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";

const HIGHLIGHTS = [
  {
    id: "charming",
    label: "Charming",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769777852/Frame_qia9ub.png",
  },
  {
    id: "hip",
    label: "Hip",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769777848/Frame_1_qvfbhl.png",
  },
  {
    id: "stylish",
    label: "Stylish",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769777845/Vector_bojse0.png",
  },
  {
    id: "upscale",
    label: "Upscale",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769777840/Frame_2_yjfvz6.png",
  },
  {
    id: "central",
    label: "Central",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769777837/Frame_3_eqbyvf.png",
  },
  {
    id: "unique",
    label: "Unique",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769777836/Vector_1_ow3fjl.png",
  },
];

const Step2Describe = ({ onValidityChange, onDataChange }) => {
  const [selectedHighlights, setSelectedHighlights] = useState([]);
  const [category, setCategory] = useState("ryokan");

  useEffect(() => {
    const loadData = async () => {
      try {
        const step1Data = await StorageService.getItem("step 1 host");
        if (step1Data && step1Data.placeType) {
          setCategory(step1Data.placeType.toLowerCase());
        }

        const savedData = await StorageService.getItem(
          "step 2 description highlights",
        );
        if (savedData && savedData.highlights) {
          setSelectedHighlights(savedData.highlights);
        }
      } catch (err) {
        console.error("Failed to load highlights data:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    // Validity: At least two selections required as per documentation
    onValidityChange?.(selectedHighlights.length >= 2);
    onDataChange?.({
      "step 2 description highlights": { highlights: selectedHighlights },
    });
  }, [selectedHighlights]);

  const toggleHighlight = (id) => {
    setSelectedHighlights((prev) => {
      if (prev.includes(id)) {
        return prev.filter((h) => h !== id);
      }
      return [...prev, id];
    });
  };

  return (
    <div className="max-w-4xl w-full mx-auto md:px-4  flex flex-col h-full overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-secondary mb-3">
            Next, let's describe your {category}
          </h1>
          <p className="text-[#6A6A6A] text-[14px] md:text-[16px] leading-relaxed">
            Choose as many highlights as you'd like. We'll use these to get your
            description started.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 md:gap-6 max-w-3xl">
          {HIGHLIGHTS.map((item) => {
            const isSelected = selectedHighlights.includes(item.id);

            return (
              <motion.button
                key={item.id}
                onClick={() => toggleHighlight(item.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className={`
                  flex items-center gap-3 px-6 py-4 rounded-full border-[2px] transition-all duration-200
                  ${
                    isSelected
                      ? "border-primary bg-[#F7F7F7]"
                      : "border-gray-200 hover:border-secondary bg-white"
                  }
                `}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  {item.icon ? (
                    <img
                      src={item.icon}
                      alt={item.label}
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full opacity-40 border border-dashed border-gray-300 rounded" />
                  )}
                </div>
                <span className="text-base font-medium text-secondary">
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default Step2Describe;
