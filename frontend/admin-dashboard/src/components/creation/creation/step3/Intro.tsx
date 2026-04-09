// @ts-nocheck
import React from 'react';
import { motion } from 'framer-motion';

const Intro = () => {
  return (
     <div className="w-full h-full overflow-y-auto no-scrollbar max-w-5xl flex flex-col lg:flex-row items-center justify-around gap-0 lg:gap-10">
      {/* Left Content Side */}
      <div className="flex-1 space-y-2 text-left max-w-md">
        <p className="text-secondary font-medium text-lg lg:text-lg">Step 3</p>
        <h1 className="text-4xl lg:text-4xl font-medium text-[#121212] tracking-tight leading-[1] md:leading-[1.1]">
         Finish up and publish
        </h1>
        <p className="text-[#484848] leading-[1.2] md:leading-none w-full max-w-md text-base lg:text-sm font-normal pt-3">
         Finally, you'll choose booking settings, set up pricing, and publish your listing.
        </p>
      </div>

      {/* Right Image Side */}
      <div className="flex-1 w-full flex justify-center lg:justify-end mt-8 lg:mt-0">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-[600px]"
        >
          <img 
            src="https://res.cloudinary.com/di9tb45rl/image/upload/q_auto,f_auto,w_800/v1769525974/Rectangle_fjmkir.png" 
            alt="Step 1 Illustration" 
            className="w-full h-auto object-contain"
            loading='lazy'
          />
        </motion.div>
      </div>
    </div>
  );
};

export default Intro;
