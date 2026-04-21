import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiCopy, FiRefreshCw } from 'react-icons/fi';
import { api } from '../../utils/api';

interface IcalFeedPanelProps {
  unitId: string;
  icalFeedToken: string;
  onTokenRotated: (newToken: string) => void;
}

// The API base URL points at /api, but the iCal route sits above that prefix
// because Airbnb does not carry custom prefixes. Strip the trailing /api so
// the operator gets the exact URL to paste into Airbnb.
function resolveIcalOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
  return raw.replace(/\/api\/?$/, '');
}

export default function IcalFeedPanel({ unitId, icalFeedToken, onTokenRotated }: IcalFeedPanelProps) {
  const [isRotating, setIsRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const icalUrl = `${resolveIcalOrigin()}/ical/${icalFeedToken}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
      toast.success('URL copiada');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const rotate = async () => {
    setIsRotating(true);
    try {
      const { data } = await api.post<{ ical_feed_token: string }>(
        `/admin/units/${unitId}/regenerate-ical-token`
      );
      onTokenRotated(data.ical_feed_token);
      toast.success('Token regenerado. Actualizá la URL en Airbnb.');
      setShowRotateConfirm(false);
    } catch {
      toast.error('No se pudo regenerar el token');
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-[#ebebeb] bg-[#fafafa] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#6a6a6a]">
          URL iCal para Airbnb
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#b91c1c] hover:underline disabled:opacity-50"
          onClick={() => setShowRotateConfirm(true)}
          disabled={isRotating}
          aria-label="Regenerar URL iCal"
        >
          <FiRefreshCw className="h-3 w-3" aria-hidden="true" />
          Regenerar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-[#ebebeb] bg-white px-2 py-1.5 text-xs text-[#222]">
          {icalUrl}
        </code>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-[#dddddd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#484848] hover:bg-[#f2f2f2]"
          onClick={copy}
          aria-label="Copiar URL iCal"
        >
          <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />
          Copiar
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
            <h3 className="text-lg font-semibold text-[#222]">¿Regenerar URL iCal?</h3>
            <p className="mt-2 text-sm text-[#6a6a6a]">
              La URL actual deja de funcionar inmediatamente. Tenés que pegar la nueva URL en Airbnb
              o Airbnb dejará de ver la disponibilidad.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-[#dddddd] px-4 py-2 text-sm font-medium text-[#484848] hover:bg-[#f7f7f7]"
                onClick={() => setShowRotateConfirm(false)}
                disabled={isRotating}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-full bg-[#e31c5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c71752] disabled:opacity-60"
                onClick={() => void rotate()}
                disabled={isRotating}
              >
                {isRotating ? 'Regenerando...' : 'Regenerar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
