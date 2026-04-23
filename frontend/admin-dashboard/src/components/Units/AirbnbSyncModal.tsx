import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiAlertCircle, FiUsers, FiHome } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../utils/api';

interface AlreadyImportedListing {
  listingId: string;
  airbnbUrl: string;
  unitId: string | null;
  name: string | null;
  thumbnail: string | null;
  nightlyRate: number | null;
}

interface NewListing {
  listingId: string;
  airbnbUrl: string;
  name: string;
  description: string;
  thumbnail: string | null;
  images: string[];
  maxGuests: number;
  bedrooms: number;
  beds: number;
  latitude: number | null;
  longitude: number | null;
  locationSubtitle: string | null;
  // user-supplied
  airbnbIcalUrl: string;
  nightlyRate: number | null;
}

interface SyncPreview {
  alreadyImported: AlreadyImportedListing[];
  newListings: NewListing[];
}

interface UserInputs {
  [listingId: string]: {
    airbnbIcalUrl: string;
    nightlyRate: string;
  };
}

interface AirbnbSyncModalProps {
  onClose: () => void;
  onImported: () => void;
}

type Phase = 'idle' | 'loading' | 'preview' | 'confirming' | 'done';
type HostIdStatus = 'checking' | 'ready' | 'missing';

export default function AirbnbSyncModal({ onClose, onImported }: AirbnbSyncModalProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [userInputs, setUserInputs] = useState<UserInputs>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [hostIdStatus, setHostIdStatus] = useState<HostIdStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    const checkHostId = async () => {
      try {
        const { data } = await api.get<{ key: string; value: string }[]>('/admin/settings');
        if (cancelled) return;
        const hostRow = data.find((r) => r.key === 'airbnb_host_id');
        const hostId = hostRow?.value?.trim() ?? '';
        setHostIdStatus(hostId ? 'ready' : 'missing');
      } catch {
        if (!cancelled) setHostIdStatus('missing');
      }
    };
    void checkHostId();
    return () => {
      cancelled = true;
    };
  }, []);

  const startSync = async () => {
    setPhase('loading');
    setApiError(null);
    try {
      const { data } = await api.post<SyncPreview>('/admin/units/sync-airbnb');
      const inputs: UserInputs = {};
      for (const listing of data.newListings) {
        inputs[listing.listingId] = { airbnbIcalUrl: '', nightlyRate: '' };
      }
      setUserInputs(inputs);
      setPreview(data);
      setPhase('preview');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('airbnbSync.errorFetch');
      setApiError(msg);
      setPhase('idle');
    }
  };

  const updateInput = (listingId: string, field: 'airbnbIcalUrl' | 'nightlyRate', value: string) => {
    setUserInputs((prev) => ({
      ...prev,
      [listingId]: { ...prev[listingId], [field]: value }
    }));
    if (errors[`${listingId}_${field}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`${listingId}_${field}`];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    if (!preview) return false;
    const next: Record<string, string> = {};

    for (const listing of preview.newListings) {
      const inputs = userInputs[listing.listingId];
      const ical = inputs?.airbnbIcalUrl.trim() ?? '';
      const rate = inputs?.nightlyRate.trim() ?? '';

      if (!ical) {
        next[`${listing.listingId}_airbnbIcalUrl`] = t('airbnbSync.errorIcalRequired');
      } else {
        try {
          new URL(ical);
        } catch {
          next[`${listing.listingId}_airbnbIcalUrl`] = t('airbnbSync.errorIcalInvalid');
        }
      }

      if (!rate) {
        next[`${listing.listingId}_nightlyRate`] = t('airbnbSync.errorRateRequired');
      } else if (isNaN(Number(rate)) || Number(rate) <= 0) {
        next[`${listing.listingId}_nightlyRate`] = t('airbnbSync.errorRateInvalid');
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const confirm = async () => {
    if (!preview || !validate()) return;

    setPhase('confirming');
    setApiError(null);

    const listings = preview.newListings.map((listing) => ({
      listingId: listing.listingId,
      name: listing.name,
      description: listing.description,
      images: listing.images,
      maxGuests: listing.maxGuests,
      bedrooms: listing.bedrooms,
      beds: listing.beds,
      latitude: listing.latitude,
      longitude: listing.longitude,
      locationSubtitle: listing.locationSubtitle,
      airbnbIcalUrl: userInputs[listing.listingId].airbnbIcalUrl.trim(),
      nightlyRate: Number(userInputs[listing.listingId].nightlyRate)
    }));

    try {
      await api.post('/admin/units/sync-airbnb/confirm', { listings });
      setPhase('done');
      toast.success(
        t('airbnbSync.importedCount', { count: listings.length })
      );
      onImported();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('airbnbSync.errorConfirm');
      setApiError(msg);
      setPhase('preview');
    }
  };

  const hasNew = (preview?.newListings.length ?? 0) > 0;
  const hasAlready = (preview?.alreadyImported.length ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={() => phase !== 'loading' && phase !== 'confirming' && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#f0f0f0] shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#222222]">{t('airbnbSync.title')}</h2>
            <p className="text-sm text-[#717171] mt-0.5">{t('airbnbSync.subtitle')}</p>
          </div>
          {phase !== 'loading' && phase !== 'confirming' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[#717171] hover:bg-[#f7f7f7] hover:text-[#222222] transition-colors"
              aria-label={t('airbnbSync.close')}
            >
              <FiX className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <AnimatePresence mode="wait">
            {(phase === 'idle' || phase === 'loading') && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                {phase === 'idle' ? (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f7ff] text-[#2563EB]">
                      <FiHome className="h-7 w-7" />
                    </div>
                    <p className="text-sm text-[#484848] max-w-sm mx-auto">{t('airbnbSync.description')}</p>
                    {hostIdStatus === 'missing' && (
                      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 text-left">
                        <FiAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{t('airbnbSync.hostIdMissing')}</span>
                      </div>
                    )}
                    {apiError && (
                      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <FiAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{apiError}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f7ff]">
                      <svg
                        className="h-7 w-7 animate-spin text-[#2563EB]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[#484848]">{t('airbnbSync.scanning')}</p>
                    <p className="text-xs text-[#717171] mt-1">{t('airbnbSync.scanningNote')}</p>
                  </>
                )}
              </motion.div>
            )}

            {(phase === 'preview' || phase === 'confirming') && preview && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {apiError && (
                  <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <FiAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{apiError}</span>
                  </div>
                )}

                {/* Already imported */}
                {hasAlready && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171] mb-3">
                      {t('airbnbSync.alreadyImported', { count: preview.alreadyImported.length })}
                    </h3>
                    <div className="space-y-2">
                      {preview.alreadyImported.map((listing) => (
                        <div
                          key={listing.listingId}
                          className="flex items-center gap-3 rounded-2xl border border-[#ebebeb] bg-[#fafafa] px-4 py-3 opacity-60"
                        >
                          {listing.thumbnail ? (
                            <img
                              src={listing.thumbnail}
                              alt={listing.name ?? listing.listingId}
                              className="h-10 w-14 rounded-lg object-cover shrink-0 grayscale"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-10 w-14 rounded-lg bg-[#e9e9e9] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#484848]">
                              {listing.name ?? `Listing ${listing.listingId}`}
                            </p>
                            <p className="text-xs text-[#717171]">
                              ID {listing.listingId}
                              {listing.nightlyRate != null && ` · $${listing.nightlyRate}/night`}
                            </p>
                          </div>
                          <FiCheck className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* New listings */}
                {hasNew ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171] mb-3">
                      {t('airbnbSync.newListings', { count: preview.newListings.length })}
                    </h3>
                    <div className="space-y-4">
                      {preview.newListings.map((listing) => (
                        <div
                          key={listing.listingId}
                          className="rounded-2xl border border-[#ebebeb] bg-white overflow-hidden"
                        >
                          <div className="flex items-start gap-3 p-4">
                            {listing.thumbnail ? (
                              <img
                                src={listing.thumbnail}
                                alt={listing.name}
                                className="h-16 w-20 rounded-xl object-cover shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-16 w-20 rounded-xl bg-[#f0f0f0] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#222222] truncate">{listing.name}</p>
                              {listing.locationSubtitle && (
                                <p className="text-xs text-[#717171] mt-0.5">{listing.locationSubtitle}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 text-xs text-[#6a6a6a]">
                                  <FiUsers className="h-3 w-3" />
                                  {t('airbnbSync.guests', { count: listing.maxGuests })}
                                </span>
                                <span className="text-xs text-[#6a6a6a]">
                                  {t('airbnbSync.bedrooms', { count: listing.bedrooms })}
                                </span>
                                <span className="text-xs text-[#6a6a6a]">
                                  {t('airbnbSync.beds', { count: listing.beds })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-[#f5f5f5] grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-4 pt-3">
                            <div>
                              <label
                                htmlFor={`ical-${listing.listingId}`}
                                className="block text-xs font-medium text-[#484848] mb-1"
                              >
                                {t('airbnbSync.icalLabel')}
                                <span className="text-red-500 ml-0.5">*</span>
                              </label>
                              <input
                                id={`ical-${listing.listingId}`}
                                type="url"
                                placeholder="https://www.airbnb.com/calendar/ical/..."
                                value={userInputs[listing.listingId]?.airbnbIcalUrl ?? ''}
                                onChange={(e) => updateInput(listing.listingId, 'airbnbIcalUrl', e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2 text-sm text-[#222222] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-colors ${
                                  errors[`${listing.listingId}_airbnbIcalUrl`]
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-[#dddddd] bg-white hover:border-[#c0c0c0]'
                                }`}
                                disabled={phase === 'confirming'}
                              />
                              {errors[`${listing.listingId}_airbnbIcalUrl`] && (
                                <p className="mt-1 text-xs text-red-600">
                                  {errors[`${listing.listingId}_airbnbIcalUrl`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label
                                htmlFor={`rate-${listing.listingId}`}
                                className="block text-xs font-medium text-[#484848] mb-1"
                              >
                                {t('airbnbSync.rateLabel')}
                                <span className="text-red-500 ml-0.5">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#717171]">$</span>
                                <input
                                  id={`rate-${listing.listingId}`}
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  placeholder="50"
                                  value={userInputs[listing.listingId]?.nightlyRate ?? ''}
                                  onChange={(e) => updateInput(listing.listingId, 'nightlyRate', e.target.value)}
                                  className={`w-full rounded-xl border pl-7 pr-3 py-2 text-sm text-[#222222] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-colors ${
                                    errors[`${listing.listingId}_nightlyRate`]
                                      ? 'border-red-300 bg-red-50'
                                      : 'border-[#dddddd] bg-white hover:border-[#c0c0c0]'
                                  }`}
                                  disabled={phase === 'confirming'}
                                />
                              </div>
                              {errors[`${listing.listingId}_nightlyRate`] && (
                                <p className="mt-1 text-xs text-red-600">
                                  {errors[`${listing.listingId}_nightlyRate`]}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700 text-center">
                    {t('airbnbSync.allImported')}
                  </div>
                )}
              </motion.div>
            )}

            {phase === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <FiCheck className="h-7 w-7" />
                </div>
                <p className="text-base font-semibold text-[#222222]">{t('airbnbSync.doneTitle')}</p>
                <p className="text-sm text-[#717171] mt-1">{t('airbnbSync.doneDesc')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0] shrink-0">
          {phase === 'done' ? (
            <button type="button" className="primary-button" onClick={onClose}>
              {t('airbnbSync.close')}
            </button>
          ) : phase === 'idle' ? (
            <>
              <button
                type="button"
                className="rounded-full border border-[#dddddd] px-4 py-2 text-sm font-medium text-[#484848] hover:bg-[#f7f7f7]"
                onClick={onClose}
              >
                {t('airbnbSync.cancel')}
              </button>
              {hostIdStatus === 'missing' ? (
                <Link
                  to="/settings"
                  onClick={onClose}
                  className="primary-button"
                >
                  {t('airbnbSync.setHostIdFirst')}
                </Link>
              ) : (
                <button
                  type="button"
                  className="primary-button disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => void startSync()}
                  disabled={hostIdStatus === 'checking'}
                >
                  {t('airbnbSync.scan')}
                </button>
              )}
            </>
          ) : phase === 'loading' ? (
            <button type="button" className="primary-button opacity-60 cursor-not-allowed" disabled>
              {t('airbnbSync.scanning')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="rounded-full border border-[#dddddd] px-4 py-2 text-sm font-medium text-[#484848] hover:bg-[#f7f7f7] disabled:opacity-50"
                onClick={onClose}
                disabled={phase === 'confirming'}
              >
                {t('airbnbSync.cancel')}
              </button>
              {hasNew && (
                <button
                  type="button"
                  className="primary-button disabled:opacity-60"
                  onClick={() => void confirm()}
                  disabled={phase === 'confirming'}
                >
                  {phase === 'confirming'
                    ? t('airbnbSync.importing')
                    : t('airbnbSync.importCount', { count: preview?.newListings.length ?? 0 })}
                </button>
              )}
              {!hasNew && (
                <button type="button" className="primary-button" onClick={onClose}>
                  {t('airbnbSync.close')}
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
