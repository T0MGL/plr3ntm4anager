import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { api } from '../../utils/api';
import ApprovalButtons from './ApprovalButtons';
import BookingDetails from './BookingDetails';
import { supabase } from '../../context/AuthContext';

interface BookingRow {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  total_price_usd: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | string;
  special_requests?: string | null;
  created_at?: string;
  rejection_reason?: string | null;
  units?: { name: string } | null;
}

interface BookingResponse {
  data: BookingRow[];
  count: number;
}

function statusChipClass(status: string): string {
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'approved') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function BookingList() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingBookingId, setActingBookingId] = useState<string | null>(null);

  const [rejectModalBookingId, setRejectModalBookingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchBookings = async () => {
    const { data } = await api.get<BookingResponse>('/admin/booking-requests', {
      params: status ? { status } : {}
    });
    setBookings(data.data ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await fetchBookings();
        setError(null);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load bookings';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [status]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, () => {
        void fetchBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [status]);

  const approve = async (bookingId: string) => {
    try {
      setActingBookingId(bookingId);
      await api.post(`/admin/booking-requests/${bookingId}/approve`);
      await fetchBookings();
      setError(null);
    } catch (approveError) {
      const message = approveError instanceof Error ? approveError.message : 'Failed to approve booking';
      setError(message);
    } finally {
      setActingBookingId(null);
    }
  };

  const openRejectModal = (bookingId: string) => {
    setRejectModalBookingId(bookingId);
    setRejectionReason('Not available for selected dates.');
  };

  const closeRejectModal = () => {
    setRejectModalBookingId(null);
    setRejectionReason('');
  };

  const confirmReject = async () => {
    if (!rejectModalBookingId) return;
    const reason = rejectionReason.trim();
    if (reason.length < 2) {
      setError('Rejection reason must be at least 2 characters.');
      return;
    }

    try {
      setActingBookingId(rejectModalBookingId);
      await api.post(`/admin/booking-requests/${rejectModalBookingId}/reject`, { rejection_reason: reason });
      await fetchBookings();
      closeRejectModal();
      setError(null);
    } catch (rejectError) {
      const message = rejectError instanceof Error ? rejectError.message : 'Failed to reject booking';
      setError(message);
    } finally {
      setActingBookingId(null);
    }
  };

  const summary = useMemo(() => {
    return bookings.reduce(
      (acc, booking) => {
        acc.total += 1;
        if (booking.status === 'pending') acc.pending += 1;
        if (booking.status === 'approved') acc.approved += 1;
        if (booking.status === 'paid') acc.paid += 1;
        if (booking.status === 'rejected') acc.rejected += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, paid: 0, rejected: 0 },
    );
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bookings;

    return bookings.filter((booking) => {
      const unit = booking.units?.name?.toLowerCase() ?? '';
      return (
        booking.guest_name.toLowerCase().includes(term) ||
        booking.guest_email.toLowerCase().includes(term) ||
        unit.includes(term)
      );
    });
  }, [bookings, search]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700">Pending</p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{summary.pending}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-sky-700">Approved</p>
          <p className="mt-1 text-xl font-semibold text-sky-800">{summary.approved}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Paid</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{summary.paid}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-700">Rejected</p>
          <p className="mt-1 text-xl font-semibold text-rose-800">{summary.rejected}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guest, email, or unit"
          className="w-full min-w-[230px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          onClick={() => void fetchBookings()}
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      {isLoading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading bookings...</div> : null}

      {!isLoading && filteredBookings.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No bookings found for current filters.</div>
      ) : null}

      {!isLoading ? (
        <div className="grid gap-3">
          {filteredBookings.map((booking) => {
            const created = booking.created_at
              ? formatDistanceToNow(parseISO(booking.created_at), { addSuffix: true })
              : null;

            return (
              <div key={booking.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{booking.units?.name ?? 'Unit'}</h3>
                    <p className="text-xs text-slate-500">Booking ID: {booking.id}</p>
                    {created ? <p className="text-xs text-slate-500">Requested {created}</p> : null}
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusChipClass(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>

                <BookingDetails booking={booking} />

                {booking.rejection_reason ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Rejection reason: {booking.rejection_reason}
                  </div>
                ) : null}

                {booking.status === 'pending' ? (
                  <div className="mt-3">
                    <ApprovalButtons
                      onApprove={() => void approve(booking.id)}
                      onReject={() => openRejectModal(booking.id)}
                      isLoading={actingBookingId === booking.id}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {rejectModalBookingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
            <h4 className="text-lg font-semibold text-slate-900">Reject booking request</h4>
            <p className="mt-1 text-sm text-slate-500">
              Provide a clear reason. This message is sent to the guest.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reason for rejection"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                onClick={closeRejectModal}
                disabled={actingBookingId === rejectModalBookingId}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void confirmReject()}
                disabled={actingBookingId === rejectModalBookingId}
              >
                {actingBookingId === rejectModalBookingId ? 'Rejecting...' : 'Confirm reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
