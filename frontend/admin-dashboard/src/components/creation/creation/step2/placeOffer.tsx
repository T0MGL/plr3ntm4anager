// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";

const AMENITY_SECTIONS = [
  {
    title: "What about these guest favorites?",
    amenities: [
      {
        label: "Wifi",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770001/l_d_5243_ia6dvf.png",
      },
      {
        label: "TV",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5213_qnbqbg.png",
      },
      {
        label: "Kitchen",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5291_ry1asq.png",
      },
      {
        label: "Washer",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5388_dvcpgw.png",
      },
      {
        label: "Free parking on premises",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5411_aphx5c.png",
      },
      {
        label: "Paid parking on premises",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_5499_nq0zz2.png",
      },
      {
        label: "Air conditioning",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769771269/l_d_5563_izqndj.png",
      },
      {
        label: "Dedicated workspace",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5536_pmledh.png",
      },
    ],
  },
  {
    title: "Do you have any standout amenities?",
    amenities: [
      {
        label: "Pool",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5575_dyplg0.png",
      },
      {
        label: "Hot tub",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5615_dcw0qm.png",
      },
      {
        label: "Patio",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5663_cfmqfb.png",
      },
      {
        label: "BBQ grill",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_5716_xsm7sb.png",
      },
      {
        label: "Outdoor dining area",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_5785_awbhlf.png",
      },
      {
        label: "Fire pit",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_5817_vcadcl.png",
      },
      {
        label: "Pool table",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_5941_p8b0kp.png",
      },
      {
        label: "Indoor fireplace",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_5981_ytb2rl.png",
      },
      {
        label: "Piano",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_6020_ckg39u.png",
      },
      {
        label: "Exercise equipment",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769999/l_d_6073_tny0mh.png",
      },
      {
        label: "Lake access",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6097_icgflz.png",
      },
      {
        label: "Beach access",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769770000/l_d_6205_gdpip3.png",
      },
      {
        label: "Ski-in/Ski-out",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6317_ccozya.png",
      },
      {
        label: "Outdoor shower",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6348_xgfbfw.png",
      },
    ],
  },
  {
    title: "Do you have any of these safety items?",
    amenities: [
      {
        label: "Smoke alarm",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6542_yqhvdc.png",
      },
      {
        label: "First aid kit",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769998/l_d_6577_qcmfth.png",
      },
      {
        label: "Fire extinguisher",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_6636_oy4sas.png",
      },
      {
        label: "Carbon monoxide alarm",
        icon: "https://res.cloudinary.com/di9tb45rl/image/upload/v1769769997/l_d_6677_cyzdbb.png",
      },
    ],
  },
];

const PlaceOffer = ({ onValidityChange, onDataChange }) => {
  const [selectedAmenities, setSelectedAmenities] = useState([]);

  useEffect(() => {
    const restoreData = async () => {
      try {
        const savedData = await StorageService.getItem("step 2 host");
        if (savedData && savedData.amenities) {
          setSelectedAmenities(savedData.amenities);
        }
      } catch (err) {
        console.error("Failed to restore amenities:", err);
      }
    };
    restoreData();
  }, []);

  useEffect(() => {
    // Usually, amenities are optional, but let's assume they might be required for validation if needed
    // For now, it's always valid as they can add more later
    onValidityChange?.(true);
    onDataChange?.({ "step 2 host": { amenities: selectedAmenities } });
  }, [selectedAmenities, onValidityChange, onDataChange]);

  const toggleAmenity = (label) => {
    setSelectedAmenities((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  };

  return (
    <div className="w-full h-full flex flex-col items-center overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 max-w-3xl w-full bg-white z-10 ">
        <h1 className="text-2xl  font-semibold text-[#222222] text-left">
          Amenidades de la unidad
        </h1>
        <p className="text-sm md:text-base text-[#717171] text-left mt-2">
          Podes agregar mas o editar este listado despues de publicar.
        </p>
      </div>

      {/* Scrollable Grid Section */}
      <div className="flex-1 w-full overflow-y-auto px-1 py-2 mt-2">
        <div className="w-full max-w-2xl mx-auto space-y-10 pb-10">
          {AMENITY_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-6">
              <h2 className="text-lg font-semibold text-[#222222]">
                {section.title}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {section.amenities.map((item) => (
                  <motion.button
                    key={item.label}
                    onClick={() => toggleAmenity(item.label)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    className={`
                      flex flex-col p-4 h-[88px] rounded-xl border-2 cursor-pointer transition-all items-start justify-between
                      ${
                        selectedAmenities.includes(item.label)
                          ? "bg-[#F7F7F7] border-primary ring-0"
                          : "border-gray-200 hover:border-primary bg-white"
                      }
                    `}
                  >
                    {/* Icon Placeholder */}
                    <div className="text-2xl text-[#222222]">
                      <div className="w-6 h-6 flex items-center justify-center">
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
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          /* Space for now */
                          <div className="w-6 h-6 border-2 border-dashed border-gray-300 rounded opacity-40" />
                        )}
                      </div>
                    </div>

                    {/* Text Label */}
                    <span className="text-[14px] sm:text-[16px] md:text-[17px] mt-2 font-medium text-[#222222] line-clamp-2 w-full text-left leading-tight">
                      {item.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaceOffer;
