// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = ({
  currentStep,
  onNext,
  onBack,
  isFirst,
  isLast,
  nextDisabled,
  backDisabled,
  compact = false,
  hideNextButton = false,
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-full border-t border-[#e5e7eb] bg-white/95 backdrop-blur">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 ${compact ? 'max-w-5xl px-4 py-3 sm:px-6' : 'max-w-6xl px-6 py-4 sm:px-12'}`}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isFirst || backDisabled}
          className={
            isFirst || backDisabled
              ? 'rounded-full border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#9ca3af]'
              : 'rounded-full border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#374151] hover:border-[#9ca3af]'
          }
        >
          {t('creation.back')}
        </button>

        <div className="text-xs text-[#6b7280]">
          {t('creation.step', { current: currentStep, total: 4 })}
        </div>

        {!hideNextButton ? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={
              nextDisabled
                ? 'rounded-full bg-[#93c5fd] px-5 py-2 text-sm font-semibold text-white'
                : 'rounded-full bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#172d69]'
            }
          >
            {isLast ? t('creation.publish') : t('creation.next')}
          </button>
        ) : (
          <div className="w-[76px]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export default Footer;
