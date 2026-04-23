import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiChevronDown, FiDownload, FiFileText } from 'react-icons/fi';
import {
  downloadExport,
  type ExportFilters,
  type ExportFormat,
  type ExportKind,
} from '../../services/data-export';

interface ExportMenuProps {
  kind: ExportKind;
  filters: ExportFilters;
  disabled?: boolean;
}

export default function ExportMenu({ kind, filters, disabled }: ExportMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (format: ExportFormat) => {
    if (busy) return;
    setOpen(false);
    setBusy(format);
    try {
      await downloadExport(kind, format, filters);
      toast.success(t('exportMenu.started'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('exportMenu.failed');
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const buttonLabel = busy ? t('exportMenu.exporting') : t('exportMenu.export');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiDownload className="h-4 w-4" aria-hidden="true" />
        {buttonLabel}
        <FiChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void run('xlsx')}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <FiFileText className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {t('exportMenu.excel')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void run('pdf')}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <FiFileText className="h-4 w-4 text-rose-600" aria-hidden="true" />
            {t('exportMenu.pdf')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
