import { useState } from 'react';
import { FiLoader, FiX } from 'react-icons/fi';

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

// Generic confirmation modal used by destructive or sensitive Team actions
// (deactivate, reactivate, send password reset, reinvite).
export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  destructive,
  onConfirm,
  onClose,
}: ConfirmActionModalProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    if (pending) return;
    setError(null);
    setPending(false);
    onClose();
  };

  const handle = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setPending(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      setPending(false);
    }
  };

  const confirmClass = destructive
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : 'bg-slate-900 hover:bg-slate-800 text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
          <button
            type="button"
            className="text-slate-400 transition-colors hover:text-slate-600"
            onClick={close}
            aria-label="Close"
          >
            <FiX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-slate-600">{description}</p>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handle()}
            disabled={pending}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}
          >
            {pending ? (
              <>
                <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
