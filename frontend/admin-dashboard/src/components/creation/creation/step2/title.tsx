// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";

const Step2Title = ({ onValidityChange, onDataChange }) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("house");
  const MAX_CHARS = 100;

  useEffect(() => {
    const loadData = async () => {
      try {
        const step1Data = await StorageService.getItem("step 1 host");
        if (step1Data && step1Data.placeType) {
          setCategory(step1Data.placeType.toLowerCase());
        }

        const savedData = await StorageService.getItem("step 2 title");
        if (savedData && savedData.title) {
          setTitle(savedData.title);
        }
      } catch (err) {
        console.error("Failed to load title data:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    onValidityChange?.(title.trim().length > 0 && title.length <= MAX_CHARS);
    onDataChange?.({ "step 2 title": { title } });
  }, [title]);

  return (
    <div className="max-w-4xl w-full mx-auto md:px-4  flex flex-col h-full overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-semibold text-secondary mb-2">
            Now, let's give your {category} a title
          </h1>
          <p className="text-[#6A6A6A] text-[14px] md:text-[16px] leading-relaxed">
            Short titles work best. Have fun with it—you can always change it
            later.
          </p>
        </div>

        <div className="relative w-full">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Type here..."
            className="w-full h-[180px] md:h-[220px] p-4 md:p-5 text-base md:text-lg font-normal text-secondary border border-gray-200 rounded-2xl focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all resize-none placeholder:text-[#B0B0B0]"
            maxLength={MAX_CHARS}
          />

          <div className="mt-4 flex justify-end">
            <span
              className={`text-base font-semibold ${title.length === MAX_CHARS ? "text-red-500" : "text-[#717171a6]"}`}
            >
              {title.length}/{MAX_CHARS}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Step2Title;
