import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { FiLoader, FiSend } from 'react-icons/fi';
import { createBookingNote, listBookingNotes, type BookingNote } from '../../services/booking-notes';

interface BookingNotesProps {
  bookingId: string;
}

type Status = 'loading' | 'ready' | 'error';

export default function BookingNotes({ bookingId }: BookingNotesProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    listBookingNotes(bookingId)
      .then((rows) => {
        if (cancelled) return;
        setNotes(rows);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('bookingNotes.loadFailed'));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [bookingId, t]);

  const submit = async () => {
    const content = draft.trim();
    if (!content || isSending) return;

    setIsSending(true);
    // Optimistic insert. We replace the temporary row with the server payload
    // once the response lands so author + timestamps are authoritative.
    const tempId = `temp-${Date.now()}`;
    const optimistic: BookingNote = {
      id: tempId,
      booking_id: bookingId,
      content,
      created_at: new Date().toISOString(),
      author: null
    };
    setNotes((prev) => [optimistic, ...prev]);
    setDraft('');

    try {
      const saved = await createBookingNote(bookingId, content);
      setNotes((prev) => prev.map((n) => (n.id === tempId ? saved : n)));
    } catch (err) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setDraft(content);
      const msg = err instanceof Error ? err.message : t('bookingNotes.sendFailed');
      toast.error(msg);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h4 className="text-sm font-semibold text-slate-900">{t('bookingNotes.title')}</h4>
        <span className="text-xs text-slate-400">{t('bookingNotes.appendOnly')}</span>
      </div>

      <div className="space-y-2 p-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={t('bookingNotes.placeholder')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          disabled={isSending}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{t('bookingNotes.hint')}</span>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!draft.trim() || isSending}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? (
              <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FiSend className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isSending ? t('bookingNotes.sending') : t('bookingNotes.add')}
          </button>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-3 text-xs text-slate-500">
          <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t('bookingNotes.loading')}
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="border-t border-rose-100 bg-rose-50 px-3 py-3 text-xs text-rose-700">
          {error ?? t('bookingNotes.loadFailed')}
        </div>
      ) : null}

      {status === 'ready' && notes.length === 0 ? (
        <p className="border-t border-slate-100 px-3 py-4 text-xs text-slate-500">
          {t('bookingNotes.empty')}
        </p>
      ) : null}

      {status === 'ready' && notes.length > 0 ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {notes.map((note) => {
            const isPending = note.id.startsWith('temp-');
            return (
              <li key={note.id} className={`px-3 py-3 text-sm ${isPending ? 'opacity-60' : ''}`}>
                <p className="whitespace-pre-wrap text-slate-700">{note.content}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {note.author?.name ?? t('bookingNotes.unknownAuthor')}
                  <span className="mx-1.5 text-slate-300">·</span>
                  {renderRelative(note.created_at)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function renderRelative(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}
