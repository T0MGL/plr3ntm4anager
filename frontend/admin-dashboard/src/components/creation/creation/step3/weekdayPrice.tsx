// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { HiOutlinePencil } from "react-icons/hi";
import { StorageService } from "../../../../services/storageService";
import toast from "react-hot-toast";

const WeekdayPrice = ({ onValidityChange, onDataChange }) => {
  const [basePrice, setBasePrice] = useState(19);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [tempPrice, setTempPrice] = useState(19);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await StorageService.getItem("step 3 weekday price");
        if (savedData && savedData.price) {
          setBasePrice(Number(savedData.price));
          setTempPrice(Number(savedData.price));
        }
      } catch (err) {
        console.error("Failed to load weekday price:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    onValidityChange?.(basePrice >= 10 && basePrice <= 10000000);
    onDataChange?.({
      "step 3 weekday price": {
        price: basePrice,
        guestPrice: basePrice,
        hostEarns: basePrice,
      },
    });
  }, [basePrice, onValidityChange, onDataChange]);

  return (
    <div className="w-full max-w-4xl mx-auto md:px-6 flex flex-col items-center justify-center  text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 md:mb-16 mt-5 w-full max-w-2xl"
      >
        <h1 className="text-2xl md:text-[32px] font-semibold text-[#222222] tracking-tight text-center">
          Now, set a weekday base price
        </h1>
      </motion.div>

      <div className="relative mb-2 w-full max-w-2xl px-4">
        <div className="flex items-center justify-center gap-2 md:gap-5">
          <span className="text-6xl sm:text-8xl md:text-[130px] font-semibold text-[#222222] tracking-tighter">
            ${basePrice.toLocaleString()}
          </span>
          <button
            onClick={() => {
              setTempPrice(basePrice.toString());
              setShowPriceModal(true);
            }}
            className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-full border border-gray-200 hover:border-gray-800 hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
          >
            <HiOutlinePencil className="text-base md:text-lg text-[#222222]" />
          </button>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {showPriceModal && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
              <motion.div
                key="price-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              />
              <motion.div
                key="price-modal"
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-[#222222]">
                    Set base price
                  </h2>
                  <p className="text-[#717171] text-[15px]">
                    Set your weekday price per night.
                  </p>
                </div>

                <div className="relative bg-[#F7F7F7] rounded-3xl p-6 border-2 border-transparent focus-within:border-[#222222] transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-semibold text-[#222222]">
                      $
                    </span>
                    <input
                      type="text"
                      value={
                        tempPrice === ""
                          ? ""
                          : Number(tempPrice).toLocaleString("en-US")
                      }
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        if (val.length <= 8) {
                          setTempPrice(val);
                        }
                      }}
                      className="w-full text-5xl font-semibold text-[#222222] bg-transparent outline-none appearance-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowPriceModal(false);
                      setTempPrice(basePrice);
                    }}
                    className="flex-1 py-4 px-6 border border-gray-300 rounded-2xl font-bold text-[#222222] hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const val = Number(tempPrice);
                      if (val >= 10 && val <= 10000000) {
                        setBasePrice(val);
                        setShowPriceModal(false);
                      } else if (val < 10) {
                        toast.error("Price must be at least $10");
                      } else {
                        toast.error("Price cannot exceed $10,000,000");
                      }
                    }}
                    className="flex-1 py-4 px-6 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default WeekdayPrice;
