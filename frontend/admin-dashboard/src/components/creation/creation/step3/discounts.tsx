// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IoCheckmark } from "react-icons/io5";
import { StorageService } from "../../../../services/storageService";

const Discounts = ({ onValidityChange, onDataChange }) => {
  const [selectedDiscounts, setSelectedDiscounts] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await StorageService.getItem("step 3 discounts");
        if (savedData && savedData.discounts) {
          setSelectedDiscounts(savedData.discounts);
        }
      } catch (err) {
        console.error("Failed to load discounts:", err);
      }
    };
    loadData();
  }, []);

  const discountOptions = [
    {
      id: "new_listing",
      value: "20%",
      title: "Promocion de lanzamiento",
      description: "20% off en las primeras 3 reservas",
    },
    {
      id: "last_minute",
      value: "11%",
      title: "Descuento last-minute",
      description: "Reservas con check-in a 14 dias o menos",
    },
    {
      id: "weekly",
      value: "5%",
      title: "Descuento semanal",
      description: "Estadias de 7 noches o mas",
    },
    {
      id: "monthly",
      value: "10%",
      title: "Descuento mensual",
      description: "Estadias de 28 noches o mas",
    },
  ];

  const toggleDiscount = (id) => {
    setSelectedDiscounts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    onValidityChange?.(true); // Always valid as it's optional
    onDataChange?.({ "step 3 discounts": { discounts: selectedDiscounts } });
  }, [selectedDiscounts]);

  return (
    <div className="w-full max-w-4xl mx-auto md:px-6 flex flex-col justify-center min-h-[70vh] pt-40 pb-8 md:pt-40 md:pb-10">
      <div className="mb-8 md:mb-12 text-left">
        <h1 className="text-2xl md:text-[32px] font-semibold text-secondary mb-2 tracking-tight">
          Descuentos aplicables
        </h1>
        <p className="text-forth text-base md:text-lg leading-relaxed">
          Opcionales. Se aplican automaticamente cuando la reserva cumple la condicion.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {discountOptions.map((discount, index) => {
          const isSelected = selectedDiscounts.includes(discount.id);
          return (
            <motion.div
              key={discount.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => toggleDiscount(discount.id)}
              className={`flex items-center p-4 md:p-5 rounded-[24px] transition-all cursor-pointer border ${
                isSelected
                  ? "border-secondary bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                  : "border-[#F0F0F0] bg-[#F7F7F7] hover:border-secondary/10"
              }`}
            >
              <div className="flex-shrink-0 w-14 h-12 md:w-16 md:h-14 flex items-center justify-center bg-white border border-[#F0F0F0] rounded-2xl mr-4 md:mr-6 shadow-sm">
                <span className="text-sm md:text-base font-bold text-secondary">
                  {discount.value}
                </span>
              </div>

              <div className="flex-grow text-left">
                <h3 className="text-base md:text-[18px] font-semibold text-secondary leading-tight tracking-tight">
                  {discount.title}
                </h3>
                <p className="text-sm md:text-[15px] text-forth leading-snug mt-1 font-normal">
                  {discount.description}
                </p>
              </div>

              <div
                className={`flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-lg border-2 flex items-center justify-center transition-all ml-4 ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-white border-[#DDDDDD]"
                }`}
              >
                {isSelected && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <IoCheckmark className="text-white text-base md:text-xl stroke-[3px]" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="text-left mt-auto md:mt-0 md:pt-6">
        <p className="text-xs md:text-[13px] text-forth leading-relaxed">
          Only one discount will be applied per stay.{" "}
          <span className=" cursor-pointer hover:text-secondary transition-colors font-medium">
            Learn more
          </span>
        </p>
      </div>
    </div>
  );
};

export default Discounts;
