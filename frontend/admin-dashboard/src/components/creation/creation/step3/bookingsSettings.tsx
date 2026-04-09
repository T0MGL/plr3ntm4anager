// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";
import { HiOutlineCalendar, HiOutlineLightningBolt } from "react-icons/hi";

const BookingSettings = ({ onValidityChange, onDataChange }) => {
  const [selectedSetting, setSelectedSetting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await StorageService.getItem(
          "step 3 booking settings",
        );
        if (savedData && savedData.bookingSetting) {
          setSelectedSetting(savedData.bookingSetting);
        }
      } catch (err) {
        console.error("Failed to load booking settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Valid only if a setting is selected
      onValidityChange?.(selectedSetting !== null);
      onDataChange?.({
        "step 3 booking settings": { bookingSetting: selectedSetting },
      });
    }
  }, [selectedSetting, isLoading]);

  const settings = [
    {
      id: "approve_first_5",
      title: "Approve your first 5 bookings",
      recommended: true,
      description:
        "Start by reviewing reservation requests, then switch to Instant Book, so guests can start booking automatically.",
      // Matching the "calendar with check" icon from the image
      icon: (
        <img
          src="https://res.cloudinary.com/di9tb45rl/image/upload/q_auto,f_auto,w_64/v1769781255/Vector_1_dljbmb.png"
          alt="calender"
          className="w-8 h-8"
          loading="lazy"
        />
      ),
    },
    {
      id: "instant_book",
      title: "Use Instant Book",
      recommended: false,
      description: "Let guests book automatically.",
      // Matching the "lightning bolt" icon from the image
      icon: (
        <img
          src="https://res.cloudinary.com/di9tb45rl/image/upload/q_auto,f_auto,w_64/v1769780965/Vector_uw69jg.png"
          alt="lightning"
          className="w-6 h-8"
          loading="lazy"
        />
      ),
    },
  ];

  if (isLoading) return null;

  return (
    <div className="max-w-4xl w-full mx-auto md:px-4 py-8 pt-2 flex flex-col h-full overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <div className="mb-14">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#222222] mb-3">
            Pick your booking settings
          </h1>
          <p className="text-[#6A6A6A] text-[14px] md:text-[16px] leading-relaxed">
            You can change this at any time.{" "}
            <span className=" cursor-pointer font-medium text-[#222222]">
              Learn more
            </span>
          </p>
        </div>

        <div className="space-y-4 max-w-2xl">
          {settings.map((setting) => {
            const isSelected = selectedSetting === setting.id;

            return (
              <motion.button
                key={setting.id}
                onClick={() => setSelectedSetting(setting.id)}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
                className={`
                  w-full text-left p-6 sm:p-8 rounded-2xl border transition-all duration-200 flex justify-between items-start gap-4
                  ${
                    isSelected
                      ? "border-[#A1642E] bg-[#F7F7F7] shadow-[0_0_0_1px_#A1642E]"
                      : "border-[#DDDDDD] hover:border-[#222222] bg-white"
                  }
                `}
              >
                <div className="flex-1">
                  <h3 className="text-[18px] font-medium text-[#222222] mb-1">
                    {setting.title}
                  </h3>
                  {setting.recommended && (
                    <p className="text-[#008A05] text-[14px] font-medium mb-2">
                      Recommended
                    </p>
                  )}
                  <p className="text-[#6A6A6A] text-[14px] leading-[1.45] max-w-sm">
                    {setting.description}
                  </p>
                </div>

                <div className="flex-shrink-0 flex items-center justify-center pt-1 mt-1">
                  <div className="">{setting.icon}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default BookingSettings;
