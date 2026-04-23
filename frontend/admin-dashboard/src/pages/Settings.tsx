import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiSave, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

type PageStatus = 'loading' | 'ready' | 'saving' | 'error';

export default function Settings() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [airbnbHostId, setAirbnbHostId] = useState('');
  const [savedAirbnbHostId, setSavedAirbnbHostId] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    const load = async () => {
      setStatus('loading');
      try {
        const { data } = await api.get<SettingRow[]>('/admin/settings');
        const hostRow = data.find((r) => r.key === 'airbnb_host_id');
        const hostId = hostRow?.value ?? '';
        setAirbnbHostId(hostId);
        setSavedAirbnbHostId(hostId);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    };
    void load();
  }, []);

  const save = async () => {
    const trimmed = airbnbHostId.trim();
    if (!trimmed) {
      setFieldError(t('settings.errorHostIdRequired'));
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setFieldError(t('settings.errorHostIdNumeric'));
      return;
    }
    setFieldError('');
    setStatus('saving');
    try {
      await api.patch('/admin/settings', [{ key: 'airbnb_host_id', value: trimmed }]);
      setSavedAirbnbHostId(trimmed);
      setStatus('ready');
      toast.success(t('settings.saved'));
    } catch {
      setStatus('ready');
      toast.error(t('settings.saveFailed'));
    }
  };

  const isDirty = airbnbHostId.trim() !== savedAirbnbHostId;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-semibold text-[#222222]">{t('settings.title')}</h2>
        <p className="mt-1 text-sm text-[#717171]">{t('settings.subtitle')}</p>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-[#717171]">
          <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('common.loading')}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('settings.loadFailed')}
        </div>
      )}

      {(status === 'ready' || status === 'saving') && (
        <div className="rounded-3xl border border-[#ebebeb] bg-white p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-[#222222] mb-1">{t('settings.airbnbSection')}</h3>
            <p className="text-sm text-[#717171]">{t('settings.airbnbSectionDesc')}</p>
          </div>

          <div>
            <label
              htmlFor="airbnb-host-id"
              className="block text-sm font-medium text-[#484848] mb-1.5"
            >
              {t('settings.airbnbHostIdLabel')}
            </label>
            <input
              id="airbnb-host-id"
              type="text"
              inputMode="numeric"
              placeholder="744342154"
              value={airbnbHostId}
              onChange={(e) => {
                setAirbnbHostId(e.target.value);
                if (fieldError) setFieldError('');
              }}
              disabled={status === 'saving'}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[#222222] placeholder:text-[#b0b0b0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-colors disabled:opacity-60 ${
                fieldError ? 'border-red-300 bg-red-50' : 'border-[#dddddd] bg-white hover:border-[#c0c0c0]'
              }`}
            />
            {fieldError && <p className="mt-1 text-xs text-red-600">{fieldError}</p>}
            <p className="mt-1.5 text-xs text-[#717171]">{t('settings.airbnbHostIdHint')}</p>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-[#222222] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#111111] disabled:opacity-50"
              onClick={() => void save()}
              disabled={status === 'saving' || !isDirty}
            >
              {status === 'saving' ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('settings.saving')}
                </>
              ) : (
                <>
                  <FiSave className="h-4 w-4" aria-hidden="true" />
                  {t('settings.save')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
