// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HiOutlineInformationCircle } from "react-icons/hi";
import { IoCheckmark } from "react-icons/io5";
import { StorageService } from "../../../../services/storageService";

const SafetyDetails = ({ onValidityChange, onDataChange }) => {
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await StorageService.getItem("step 3 safety details");
        if (savedData && savedData.selectedItems) {
          setSelectedItems(savedData.selectedItems);
        }
      } catch (err) {
        console.error("Failed to load safety details:", err);
      }
    };
    loadData();
  }, []);

  const safetyOptions = [
    { id: "security_camera", label: "Exterior security camera present" },
    { id: "noise_monitor", label: "Noise decibel monitor present" },
    { id: "weapons", label: "Weapon(s) on the property" },
  ];

  const toggleItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    onValidityChange?.(true); // Always valid as it's optional choice
    onDataChange?.({ "step 3 safety details": { selectedItems } });
  }, [selectedItems]);

  return (
    <div className="w-full max-w-3xl mx-auto md:px-6 flex flex-col min-h-[65vh] text-left">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        <h1 className="text-3xl md:text-3xl font-semibold text-secondary tracking-tight">
          Share safety details
        </h1>
      </motion.div>

      {/* Options Section */}
      <div className="space-y-2 mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl font-semibold text-secondary">
            Does your place have any of these?
          </span>
          <HiOutlineInformationCircle className="text-xl text-forth cursor-pointer" />
        </div>

        <div className="space-y-3">
          {safetyOptions.map((option, index) => {
            const isSelected = selectedItems.includes(option.id);
            return (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => toggleItem(option.id)}
                className="flex items-center justify-between group cursor-pointer"
              >
                <span className="text-lg text-secondary font-normal group-hover:text-black transition-colors">
                  {option.label}
                </span>

                <div
                  className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-white border-[#DDDDDD] group-hover:border-[#222222]"
                  }`}
                >
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <IoCheckmark className="text-white text-xl stroke-[3px]" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SafetyDetails;
