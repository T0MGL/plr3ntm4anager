// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoChevronDown, IoInformationCircleOutline } from 'react-icons/io5';
import { StorageService } from '../../../../services/storageService';

const Step4AirbnbUrls = ({ onValidityChange, onDataChange }) => {
  const [listingUrl, setListingUrl] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [errors, setErrors] = useState({ listingUrl: '', icalUrl: '' });
  const [touched, setTouched] = useState({ listingUrl: false, icalUrl: false });
  const [guideOpen, setGuideOpen] = useState(false);

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
      try { new URL(value); return true; } catch { return false; }
    };

    if (listingUrl && !isValidUrl(listingUrl)) {
      nextErrors.listingUrl = 'Ingresa una URL valida del listing.';
    }

    if (!icalUrl) {
      nextErrors.icalUrl = 'El link iCal es obligatorio para sincronizar disponibilidad.';
    } else if (!isValidUrl(icalUrl)) {
      nextErrors.icalUrl = 'Ingresa una URL iCal valida.';
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
      <h1 className="text-2xl md:text-3xl font-semibold text-[#222222] mb-2">
        Sincronizar con Airbnb
      </h1>
      <p className="text-[#6A6A6A] text-[15px] mb-8">
        Conecta el calendario de Airbnb para que la disponibilidad se mantenga sincronizada automaticamente.
      </p>

      {/* Collapsible guide */}
      <button
        type="button"
        onClick={() => setGuideOpen((v) => !v)}
        className="mb-6 flex w-full items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-left text-sm text-blue-800 transition-colors hover:bg-blue-100"
      >
        <IoInformationCircleOutline className="h-5 w-5 shrink-0" />
        <span className="flex-1 font-medium">¿De donde saco el link iCal?</span>
        <IoChevronDown className={`h-4 w-4 shrink-0 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {guideOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-6 overflow-hidden"
          >
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-4 text-sm text-[#444] space-y-2">
              <p><strong>1.</strong> Abre tu listing en Airbnb y ve a <strong>Calendario</strong>.</p>
              <p><strong>2.</strong> Click en <strong>Disponibilidad</strong> (icono de engranaje).</p>
              <p><strong>3.</strong> Baja hasta <strong>"Exportar calendario"</strong>.</p>
              <p><strong>4.</strong> Copia el link que aparece (empieza con <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs">https://www.airbnb.com/calendar/ical/...</code>).</p>
              <p><strong>5.</strong> Pega ese link en el campo de abajo.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#222222]">
            URL del listing en Airbnb <span className="font-normal text-[#999]">(opcional)</span>
          </label>
          <input
            type="url"
            value={listingUrl}
            onChange={(e) => setListingUrl(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, listingUrl: true }))}
            placeholder="https://www.airbnb.com/rooms/123456"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#222222] shadow-sm placeholder-[#aaa] transition-colors focus:border-[#222222] focus:outline-none"
          />
          <AnimatePresence>
            {touched.listingUrl && errors.listingUrl && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {errors.listingUrl}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#222222]">
            URL iCal de Airbnb <span className="font-normal text-red-400">(obligatorio)</span>
          </label>
          <input
            type="url"
            value={icalUrl}
            onChange={(e) => setIcalUrl(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, icalUrl: true }))}
            placeholder="https://www.airbnb.com/calendar/ical/123456.ics?s=..."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#222222] shadow-sm placeholder-[#aaa] transition-colors focus:border-[#222222] focus:outline-none"
          />
          <AnimatePresence>
            {touched.icalUrl && errors.icalUrl && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {errors.icalUrl}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default Step4AirbnbUrls;
