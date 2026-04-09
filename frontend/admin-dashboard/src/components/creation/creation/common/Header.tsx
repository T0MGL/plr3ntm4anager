// @ts-nocheck
import React from "react";

const Header = ({ onSaveAndExit, compact = false, hideSaveButton = false, exitOnly = false }) => {
  return (
    <div className="w-full border-b border-[#e5e7eb] bg-white/95 backdrop-blur">
      <div className={`mx-auto flex w-full items-center justify-between ${compact ? "max-w-5xl px-4 py-3 sm:px-6" : "max-w-6xl px-6 py-4 sm:px-12"}`}>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7280]">Unit creation</p>
          <h2 className={`${compact ? "text-lg sm:text-xl" : "text-xl"} font-semibold text-[#111827]`}>Create a new unit</h2>
        </div>
        <button
          type="button"
          onClick={() => onSaveAndExit?.()}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="Exit without saving"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6 text-gray-500">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Header;
