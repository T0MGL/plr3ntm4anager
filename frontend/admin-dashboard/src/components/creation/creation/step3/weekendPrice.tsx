import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiChevronDown } from 'react-icons/hi';
import { StorageService } from '../../../../services/storageService';

interface WeekendPriceProps {
  onValidityChange?: (isValid: boolean) => void;
  onDataChange?: (data: any) => void;
}

const WeekendPrice: React.FC<WeekendPriceProps> = ({ onValidityChange, onDataChange }) => {
  const [weekdayBasePrice, setWeekdayBasePrice] = useState(19);
  const [premiumPercentage, setPremiumPercentage] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculations
  const weekendBasePrice = Math.round(weekdayBasePrice * (1 + premiumPercentage / 100));

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get weekday price from storage to calculate weekend base
        const step3WeekdayData = await StorageService.getItem('step 3 weekday price') as any;
        if (step3WeekdayData && step3WeekdayData.price) {
          setWeekdayBasePrice(Number(step3WeekdayData.price));
        }

        const savedData = await StorageService.getItem('step 3 weekend price') as any;
        if (savedData && savedData.percentage !== undefined) {
          setPremiumPercentage(Number(savedData.percentage));
        }
      } catch (err) {
        console.error("Failed to load weekend price data:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    onValidityChange?.(true); // Percentage is always valid (0-99)
    onDataChange?.({
      'step 3 weekend price': {
        percentage: premiumPercentage,
        basePrice: weekendBasePrice
      }
    });
  }, [premiumPercentage, weekendBasePrice, onValidityChange, onDataChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBreakdown(false);
      }
    };
    if (showBreakdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBreakdown]);

  return (
    <div className="w-full max-w-4xl mx-auto md:px-6 flex flex-col items-center justify-center min-h-[70vh] text-left pt-6 md:pt-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 md:mb-10 w-full max-w-2xl"
      >
        <h1 className="text-2xl md:text-3xl font-semibold text-[#222222] tracking-tight text-center">
          Set a weekend price
        </h1>
        <p className="text-[#717171] text-base md:text-lg text-center mt-2">
          Add a premium for Fridays and Saturdays.
        </p>
      </motion.div>

      {/* Main Price Display */}
      <div className="relative mb-2 w-full max-w-2xl px-4 text-center">
        <div className="flex items-center justify-center">
          <span className="text-6xl sm:text-8xl md:text-[130px] font-semibold text-[#222222] tracking-tighter">
            ${weekendBasePrice.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mb-20" aria-hidden="true" />

      {/* Slider Section */}
      <div className="w-full max-w-[500px] mt-12 md:mt-auto pt-10 pb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="text-left">
            <h3 className="text-[17px] font-semibold text-[#222222]">Weekend premium</h3>
            <p className="text-[#717171] text-[15px]">Tip: Try 8%</p>
          </div>
          <div className="w-[80px] ml-0 h-[54px] border border-gray-200 rounded-[12px] flex items-center justify-center text-[18px] font-semibold text-[#222222] focus-within:border-[#222222] transition-all bg-white shadow-sm overflow-hidden">
            <input
              type="text"
              value={premiumPercentage}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                if (val === '') {
                  setPremiumPercentage(0);
                } else {
                  const num = parseInt(val);
                  if (num <= 99) setPremiumPercentage(num);
                }
              }}
              className="w-[25px] text-left outline-none bg-transparent pr-0.5"
            />
            <span className="text-[#222222] pr-1">%</span>
          </div>
        </div>

        <div className="relative h-10 flex items-center">
          <input
            type="range"
            min="0"
            max="99"
            value={premiumPercentage}
            onChange={(e) => setPremiumPercentage(Number(e.target.value))}
            className="price-range-slider w-full h-[6px] bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#222222]"
            style={{
              background: `linear-gradient(to right, #222222 0%, #222222 ${premiumPercentage}%, #E5E7EB ${premiumPercentage}%, #E5E7EB 100%)`
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[11px] text-[#717171] font-medium">0%</span>
          <span className="text-[11px] text-[#717171] font-medium">99%</span>
        </div>
      </div>
    </div>
  );
};

export default WeekendPrice;
