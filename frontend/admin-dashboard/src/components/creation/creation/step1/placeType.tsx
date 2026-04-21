// @ts-nocheck
import React, { useState } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";

// Mock data based on the provided image
const CATEGORIES = [
  {
    label: "House",
    value: "house",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537152/l_d_3940_xggmcl.png",
  },
  {
    label: "Apartment",
    value: "apartment",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537152/l_d_3957_tnqjex.png",
  },
  {
    label: "Barn",
    value: "barn",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537139/l_d_3974_pilkxa.png",
  },
  {
    label: "Bed & breakfast",
    value: "breakfast",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769540291/oie_OucsWwcPA7am_a9wudc.png",
  },
  {
    label: "Boat",
    value: "boat",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537139/Mask_group_xyyu7f.png",
  },
  {
    label: "Cabin",
    value: "cabin",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537140/l_d_4201_mkzvyk.png",
  },
  {
    label: "Camper/RV",
    value: "camper",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537137/l_d_4272_qvlb3e.png",
  },
  {
    label: "Casa particular",
    value: "casa_particular",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537137/l_d_4243_etbrqq.png",
  },
  {
    label: "Castle",
    value: "castle",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537137/l_d_4277_s6kgln.png",
  },
  {
    label: "Cave",
    value: "cave",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537137/l_d_4307_ox3wpz.png",
  },
  {
    label: "Container",
    value: "container",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537136/l_d_4332_by0s73.png",
  },
  {
    label: "Cycladic home",
    value: "cycladic_home",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537111/l_d_4349_ab51q9.png",
  },
  {
    label: "Dammuso",
    value: "dammuso",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537111/l_d_4366_cy7ilb.png",
  },
  {
    label: "Dome",
    value: "dome",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537111/l_d_4377_t15yqj.png",
  },
  {
    label: "Earth home",
    value: "earth_home",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537111/l_d_4394_bwk7eo.png",
  },
  {
    label: "Farm",
    value: "farm",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769539477/l_d_4461_pdksid.png",
  },
  {
    label: "Guesthouse",
    value: "guest_house",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537110/l_d_4478_ortvpw.png",
  },
  {
    label: "Hotel",
    value: "hotel",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537110/l_d_4495_rko7fh.png",
  },
  {
    label: "Houseboat",
    value: "houseboat",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537110/l_d_4512_xehxhc.png",
  },
  {
    label: "Kazhan",
    value: "kazhan",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537109/l_d_4532_bwtr1j.png",
  },
  {
    label: "Minsu",
    value: "minsu",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537109/l_d_4549_zr4rf2.png",
  },
  {
    label: "Riad",
    value: "riad",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537108/l_d_4558_pjgac0.png",
  },
  {
    label: "Ryokan",
    value: "ryokan",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537108/l_d_4575_k5m8ts.png",
  },
  {
    label: "Shepherd's hut",
    value: "shepherd",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537108/l_d_4600_xroo5k.png",
  },
  {
    label: "Tent",
    value: "tent",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537110/l_d_4617_hniy3t.png",
  },
  {
    label: "Tiny home",
    value: "tiny_home",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537109/l_d_4639_daqbqi.png",
  },
  {
    label: "Tower",
    value: "tower",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537108/l_d_4644_aahmt7.png",
  },
  {
    label: "Treehouse",
    value: "treehouse",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537110/l_d_4661_q2zblb.png",
  },
  {
    label: "Trullo",
    value: "trullo",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537111/l_d_4678_ddyepm.png",
  },
  {
    label: "Windmill",
    value: "windmill",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537107/l_d_4695_tosiop.png",
  },
  {
    label: "Yurt",
    value: "yurt",
    icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769537109/l_d_4749_kbzpse.png",
  },
];

const Step1PlaceType = ({ onValidityChange, onDataChange }) => {
  const [selectedType, setSelectedType] = useState(null);

  React.useEffect(() => {
    const restoreData = async () => {
      try {
        const savedData = await StorageService.getItem("step 1 host");
        if (savedData && savedData.placeType) {
          setSelectedType(savedData.placeType);
        }
      } catch (err) {
        console.error("Failed to restore placeType:", err);
      }
    };
    restoreData();
  }, []);

  React.useEffect(() => {
    onValidityChange?.(selectedType !== null);
    if (selectedType) {
      onDataChange?.({ "step 1 host": { placeType: selectedType } });
    }
  }, [selectedType, onValidityChange, onDataChange]);

  const handleSelect = (value) => {
    setSelectedType(value);
  };

  return (
    <div className="w-full h-full flex flex-col items-center overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 w-full bg-white z-10 ">
        <h1 className="text-xl md:text-2xl font-semibold text-[#222222] text-center">
          Tipo de unidad
        </h1>
      </div>

      {/* Scrollable Grid Section */}
      <div className="flex-1 w-full overflow-y-auto px-1 py-2 md:mt-10">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-x-4 md:gap-x-20 gap-y-8 w-full max-w-2xl mx-auto">
          {CATEGORIES.map((item) => {
            const isSelected = selectedType === item.value;
            return (
              <motion.button
                key={item.value}
                onClick={() => handleSelect(item.value)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className={`
                  flex flex-col p-4 h-[88px] rounded-xl border-2 cursor-pointer transition-all items-start justify-between
                  ${
                    isSelected
                      ? "bg-gray-100 border-primary ring-1 ring-primary"
                      : "bg-white border-gray-200 hover:border-primary"
                  }
                `}
              >
                {/* Icon */}
                <div className="text-2xl text-[#222222]">
                  <div className="w-6 h-6">
                    {item.icon ? (
                      <img
                        src={
                          item.icon?.includes("cloudinary.com")
                            ? item.icon.replace(
                                "/upload/",
                                "/upload/q_auto,f_auto,w_48/",
                              )
                            : item.icon
                        }
                        alt={item.label}
                        loading="lazy"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      /* Icon placeholder space */
                      <svg
                        viewBox="0 0 32 32"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        role="presentation"
                        focusable="false"
                        className="opacity-30"
                        style={{
                          display: "block",
                          height: "24px",
                          width: "24px",
                          fill: "currentColor",
                        }}
                      >
                        <path d="M16 1c2.008 0 3.463.963 4.751 3.227l.53 1.054C22.06 6.885 23.388 8 26 8c2.28 0 4 1.637 4 4.093v13.623c0 2.456-1.72 4.093-4 4.093H6c-2.28 0-4-1.637-4-4.093V12.093C2 9.637 3.72 8 6 8c2.612 0 3.94-1.115 4.719-2.719l.53-1.054C12.537 1.963 13.992 1 16 1zm0 2c-1.272 0-1.983.568-2.955 2.277l-.53 1.055C11.536 8.384 9.61 10 6 10c-1.049 0-2 .886-2 2.093v13.623c0 1.207.951 2.093 2 2.093h20c1.049 0 2-.886 2-2.093V12.093c0-1.207-.951-2.093-2-2.093-3.61 0-5.536-1.616-6.515-3.668l-.53-1.055C17.983 3.568 17.272 3 16 3z"></path>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Text Label */}
                <span className="text-[14px] sm:text-[16px] md:text-[17px] mt-2 font-medium text-[#222222] truncate w-full text-left">
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Step1PlaceType;
