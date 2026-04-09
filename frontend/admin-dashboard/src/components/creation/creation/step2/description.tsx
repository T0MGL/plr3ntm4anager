// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";

const Step2Description = ({ onValidityChange, onDataChange }) => {
  const [description, setDescription] = useState("");
  const MAX_CHARS = 100;

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await StorageService.getItem("step 2 description");
        if (savedData && savedData.description) {
          setDescription(savedData.description);
        }
      } catch (err) {
        console.error("Failed to load description data:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    // Validity: non-empty and within limit
    onValidityChange?.(
      description.trim().length > 0 && description.length <= MAX_CHARS,
    );
    onDataChange?.({ "step 2 description": { description } });
  }, [description]);

  return (
    <div className="max-w-4xl w-full mx-auto md:px-4  flex flex-col h-full overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <div className="mb-3">
          <h1 className="text-3xl font-semibold text-[#222222] mb-1">
            Create your description
          </h1>
          <p className="text-[#717171] text-[16px] font-normal">
            Share what makes your place special.
          </p>
        </div>

        <div className="relative w-full">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-[190px] md:h-[240px] p-4 md:p-5 text-base md:text-lg font-normal text-[#222222] border border-gray-300 rounded-xl focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all resize-none placeholder:text-[#B0B0B0]"
            maxLength={MAX_CHARS}
            placeholder="You'll enjoy your time at this cheerful getaway."
          />

          <div className="mt-4 flex justify-end">
            <span className="text-[16px] font-normal text-[#717171]">
              {description.length}/{MAX_CHARS}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Step2Description;
