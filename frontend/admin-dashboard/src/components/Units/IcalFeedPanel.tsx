import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiCopy, FiRefreshCw } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';

interface IcalFeedPanelProps {
  unitId: string;
  icalFeedToken: string;
  onTokenRotated: (newToken: string) => void;
}

function resolveIcalOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
  return raw.replace(/\/api\/?$/, '');
}

export default function IcalFeedPanel({ unitId, icalFeedToken, onTokenRotated }: IcalFeedPanelProps) {
  const { t } = useTranslation();
  const [isRotating, setIsRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const icalUrl = `${resolveIcalOrigin()}/ical/${icalFeedToken}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
      toast.success(t('ical.copied'));
    } catch {
      toast.error(t('ical.copyFailed'));
    }
  };

  const rotate = async () => {
    setIsRotating(true);
    try {
      const { data } = await api.post<{ ical_feed_token: string }>(
        `/admin/units/${unitId}/regenerate-ical-token`,
      );
      onTokenRotated(data.ical_feed_token);
      toast.success(t('ical.regenerated'));
      setShowRotateConfirm(false);
    } catch {
      toast.error(t('ical.regenerateFailed'));
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#aaa] shrink-0">iCal</span>
        <code className="flex-1 truncate text-[11px] text-[#888]">{icalUrl}</code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md p-1 text-[#aaa] hover:bg-[#f7f7f7] hover:text-[#484848] transition-colors"
          aria-label={t('ical.copyAriaLabel')}
          title={t('ical.copy')}
        >
          <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setShowRotateConfirm(true)}
          disabled={isRotating}
          className="shrink-0 rounded-md p-1 text-[#aaa] hover:bg-[#f7f7f7] hover:text-[#c1355b] transition-colors disabled:opacity-40"
          aria-label={t('ical.regenerateAriaLabel')}
          title={t('ical.regenerate')}
        >
          <FiRefreshCw className={`h-3.5 w-3.5 ${isRotating ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {showRotateConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => !isRotating && setShowRotateConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#222]">{t('ical.confirmTitle')}</h3>
            <p className="mt-2 text-sm text-[#6a6a6a]">{t('ical.confirmDesc')}</p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-[#dddddd] px-4 py-2 text-sm font-medium text-[#484848] hover:bg-[#f7f7f7]"
                onClick={() => setShowRotateConfirm(false)}
                disabled={isRotating}
              >
                {t('ical.cancel')}
              </button>
              <button
                type="button"
                className="rounded-full bg-[#e31c5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c71752] disabled:opacity-60"
                onClick={() => void rotate()}
                disabled={isRotating}
              >
                {isRotating ? t('ical.regenerating') : t('ical.regenerate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
