// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StorageService } from '../../../../services/storageService';

const Step4AirbnbUrls = ({ onValidityChange, onDataChange }) => {
  const [listingUrl, setListingUrl] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [errors, setErrors] = useState({ listingUrl: '', icalUrl: '' });

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await StorageService.getItem('step 4 airbnb urls');
        if (saved) {
          setListingUrl(saved.listingUrl || '');
          setIcalUrl(saved.icalUrl || '');
        }
      } catch (err) {
        console.error('Failed to restore Airbnb URLs:', err);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    const nextErrors = { listingUrl: '', icalUrl: '' };

    const isValidUrl = (value) => {
      if (!value) return false;
      try {
        new URL(value);
        return true;
      } catch (_err) {
        return false;
      }
    };

    if (listingUrl && !isValidUrl(listingUrl)) {
      nextErrors.listingUrl = 'Enter a valid Airbnb listing URL.';
    }

    if (!icalUrl) {
      nextErrors.icalUrl = 'Airbnb iCal URL is required.';
    } else if (!isValidUrl(icalUrl)) {
      nextErrors.icalUrl = 'Enter a valid Airbnb iCal URL.';
    }

    setErrors(nextErrors);

    const isValid = !nextErrors.listingUrl && !nextErrors.icalUrl;
    onValidityChange?.(isValid);

    onDataChange?.({
      'step 4 airbnb urls': {
        listingUrl: listingUrl.trim(),
        icalUrl: icalUrl.trim()
      }
    });
  }, [listingUrl, icalUrl, onValidityChange, onDataChange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl text-left"
    >
      <h1 className="text-2xl md:text-3xl font-semibold text-secondary mb-2">
        Connect Airbnb URLs
      </h1>
      <p className="text-[#6A6A6A] text-[15px] mb-8">
        Add the Airbnb listing and iCal URLs so the unit can sync availability.
      </p>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-secondary">Airbnb listing URL (optional)</label>
          <input
            type="url"
            value={listingUrl}
            onChange={(event) => setListingUrl(event.target.value)}
            placeholder="https://www.airbnb.com/rooms/123456"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {errors.listingUrl && (
            <p className="text-xs text-red-600">{errors.listingUrl}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-secondary">Airbnb iCal URL (required)</label>
          <input
            type="url"
            value={icalUrl}
            onChange={(event) => setIcalUrl(event.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/123456.ics?s=..."
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {errors.icalUrl && <p className="text-xs text-red-600">{errors.icalUrl}</p>}
        </div>
      </div>
    </motion.div>
  );
};

export default Step4AirbnbUrls;
