import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiCheck, FiEdit2, FiLoader, FiX } from 'react-icons/fi';
import { updateGuestAlias } from '../../services/availability';

interface AirbnbAliasEditorProps {
  /** availability.id of any night in the reservation range. The server
   *  stamps alias across every night automatically. */
  availabilityId: string;
  initialAlias: string | null;
  /** Optional callback so parents can reconcile their local state after a
   *  save lands. The server's updated alias value is passed in. */
  onSaved?: (aliasAfterSave: string | null) => void;
}

type Mode = 'idle' | 'editing' | 'saving';

export default function AirbnbAliasEditor({
  availabilityId,
  initialAlias,
  onSaved
}: AirbnbAliasEditorProps) {
  const { t } = useTranslation();
  const [alias, setAlias] = useState<string | null>(initialAlias);
  const [draft, setDraft] = useState<string>(initialAlias ?? '');
  const [mode, setMode] = useState<Mode>('idle');
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAlias(initialAlias);
    setDraft(initialAlias ?? '');
  }, [initialAlias]);

  useEffect(() => {
    if (mode === 'editing') inputRef.current?.focus();
  }, [mode]);

  const enterEdit = () => {
    setDraft(alias ?? '');
    setMode('editing');
  };

  const cancelEdit = () => {
    setDraft(alias ?? '');
    setMode('idle');
  };

  const save = async () => {
    const trimmed = draft.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    if (next === alias) {
      setMode('idle');
      return;
    }
    if (next && next.length > 120) {
      toast.error(t('aliasEditor.tooLong', { defaultValue: 'Alias demasiado largo (máx 120).' }));
      return;
    }

    setMode('saving');
    try {
      const updated = await updateGuestAlias(availabilityId, next);
      setAlias(updated.guest_alias ?? null);
      setDraft(updated.guest_alias ?? '');
      setMode('idle');
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1500);
      onSaved?.(updated.guest_alias ?? null);
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
            t('aliasEditor.saveFailed', { defaultValue: 'No se pudo guardar el alias.' })
          : err instanceof Error
            ? err.message
            : t('aliasEditor.saveFailed', { defaultValue: 'No se pudo guardar el alias.' });
      toast.error(msg);
      setMode('editing');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (mode === 'editing' || mode === 'saving') {
    const isSaving = mode === 'saving';
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={120}
          disabled={isSaving}
          placeholder={t('aliasEditor.placeholder', {
            defaultValue: 'Familia Rodriguez, Martin 3pax...'
          })}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          title={t('aliasEditor.save', { defaultValue: 'Guardar' })}
        >
          {isSaving ? (
            <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <FiCheck className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isSaving}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          title={t('aliasEditor.cancel', { defaultValue: 'Cancelar' })}
        >
          <FiX className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  if (alias) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{alias}</span>
        <button
          type="button"
          onClick={enterEdit}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
          title={t('aliasEditor.edit', { defaultValue: 'Editar' })}
        >
          <FiEdit2 className="h-3 w-3" aria-hidden />
          {t('aliasEditor.edit', { defaultValue: 'Editar' })}
        </button>
        {justSaved ? (
          <span className="text-[11px] font-medium text-emerald-600">
            {t('aliasEditor.saved', { defaultValue: 'Guardado' })}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEdit}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
    >
      <FiEdit2 className="h-3 w-3" aria-hidden />
      {t('aliasEditor.addAlias', { defaultValue: 'Agregar alias' })}
    </button>
  );
}
