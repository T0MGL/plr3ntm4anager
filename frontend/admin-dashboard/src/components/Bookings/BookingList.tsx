import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '../../utils/api';
import ApprovalButtons from './ApprovalButtons';
import BookingDetails from './BookingDetails';
import RiskBadge from './RiskBadge';
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
  risk_index?: number | null;
  units?: { name: string } | null;
}

interface BookingResponse {
  data: BookingRow[];
  count: number;
}

function statusChipClass(status: string): string {
  if (status === 'pending') return 'border-gold/40 bg-gold-muted text-charcoal';
  if (status === 'approved') return 'border-charcoal/20 bg-cream-50 text-charcoal';
  if (status === 'paid') return 'border-charcoal bg-charcoal text-cream';
  if (status === 'rejected') return 'border-red-300 bg-red-50 text-red-800';
  return 'border-stone bg-cream-50 text-charcoal-500';
}

function statusLabel(status: string): string {
  if (status === 'pending') return 'Pendiente';
  if (status === 'approved') return 'Aprobada';
  if (status === 'paid') return 'Pagada';
  if (status === 'rejected') return 'Rechazada';
  return status;
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
      params: status ? { status } : {},
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
        const message = loadError instanceof Error ? loadError.message : 'No se pudieron cargar las reservas.';
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

  const approve = async (bookingId: string, riskIndex?: number | null) => {
    if (typeof riskIndex === 'number' && riskIndex >= 7) {
      const confirmHighRisk = window.confirm(
        `Riesgo alto detectado (indice ${riskIndex}). ¿Aprobar de todas formas?`,
      );
      if (!confirmHighRisk) return;
    }

    try {
      setActingBookingId(bookingId);
      await api.post(`/admin/booking-requests/${bookingId}/approve`);
      await fetchBookings();
      setError(null);
    } catch (approveError) {
      const message = approveError instanceof Error ? approveError.message : 'Error al aprobar la reserva.';
      setError(message);
    } finally {
      setActingBookingId(null);
    }
  };

  const openRejectModal = (bookingId: string) => {
    setRejectModalBookingId(bookingId);
    setRejectionReason('No hay disponibilidad para las fechas solicitadas.');
  };

  const closeRejectModal = () => {
    setRejectModalBookingId(null);
    setRejectionReason('');
  };

  const confirmReject = async () => {
    if (!rejectModalBookingId) return;
    const reason = rejectionReason.trim();
    if (reason.length < 2) {
      setError('El motivo del rechazo debe tener al menos 2 caracteres.');
      return;
    }

    try {
      setActingBookingId(rejectModalBookingId);
      await api.post(`/admin/booking-requests/${rejectModalBookingId}/reject`, { rejection_reason: reason });
      await fetchBookings();
      closeRejectModal();
      setError(null);
    } catch (rejectError) {
      const message = rejectError instanceof Error ? rejectError.message : 'Error al rechazar la reserva.';
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
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total" value={summary.total} />
        <StatCard label="Pendientes" value={summary.pending} accent="gold" />
        <StatCard label="Aprobadas" value={summary.approved} />
        <StatCard label="Pagadas" value={summary.paid} accent="dark" />
        <StatCard label="Rechazadas" value={summary.rejected} accent="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-stone bg-cream-50 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar huesped, email o loft"
          className="min-w-[230px] flex-1 border border-stone bg-cream px-4 py-2.5 text-sm text-charcoal placeholder-charcoal-300 focus:border-gold focus:outline-none"
        />
        <select
          className="border border-stone bg-cream px-4 py-2.5 text-sm text-charcoal focus:border-gold focus:outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
          <option value="paid">Pagadas</option>
        </select>
        <button
          className="border border-charcoal px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-charcoal transition-all duration-300 hover:bg-charcoal hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void fetchBookings()}
          disabled={isLoading}
        >
          Refrescar
        </button>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {isLoading ? (
        <div className="border border-stone bg-cream-50 p-6 text-sm text-charcoal-500">Cargando reservas...</div>
      ) : null}

      {!isLoading && filteredBookings.length === 0 ? (
        <div className="border border-stone bg-cream-50 p-10 text-center text-sm text-charcoal-500">
          Sin reservas para los filtros actuales.
        </div>
      ) : null}

      {!isLoading ? (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => {
            const created = booking.created_at
              ? formatDistanceToNow(parseISO(booking.created_at), { addSuffix: true, locale: es })
              : null;

            return (
              <div
                key={booking.id}
                className="border border-stone bg-cream-50 p-6 transition-colors hover:border-gold/60"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-2xl text-charcoal">
                      {booking.units?.name ?? 'Loft'}
                    </h3>
                    <p className="mt-1 text-[0.625rem] uppercase tracking-[0.2em] text-charcoal-400">
                      ID: {booking.id.slice(0, 8)}
                    </p>
                    {created ? (
                      <p className="mt-1 text-xs text-charcoal-500">Solicitada {created}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-flex border px-3 py-1 text-[0.625rem] font-medium uppercase tracking-[0.2em] ${statusChipClass(booking.status)}`}
                    >
                      {statusLabel(booking.status)}
                    </span>
                    <RiskBadge riskIndex={booking.risk_index ?? null} />
                  </div>
                </div>

                <BookingDetails booking={booking} />

                {booking.rejection_reason ? (
                  <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span className="font-medium">Motivo del rechazo:</span> {booking.rejection_reason}
                  </div>
                ) : null}

                {booking.status === 'pending' ? (
                  <div className="mt-5">
                    <ApprovalButtons
                      onApprove={() => void approve(booking.id, booking.risk_index)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4">
          <div className="w-full max-w-lg border border-stone bg-cream-50 p-8">
            <div className="text-[0.625rem] uppercase tracking-[0.25em] text-gold">
              Rechazar reserva
            </div>
            <h4 className="mt-3 font-display text-2xl text-charcoal">
              Confirma el motivo del rechazo
            </h4>
            <p className="mt-2 text-sm text-charcoal-500">
              Este mensaje se envia al huesped. Se claro y respetuoso.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="mt-4 w-full border border-stone bg-cream px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none"
              placeholder="Motivo del rechazo"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="border border-charcoal/30 px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-charcoal-500 transition-all hover:border-charcoal hover:text-charcoal"
                onClick={closeRejectModal}
                disabled={actingBookingId === rejectModalBookingId}
              >
                Cancelar
              </button>
              <button
                className="border border-charcoal bg-charcoal px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-cream transition-all hover:bg-gold hover:border-gold disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void confirmReject()}
                disabled={actingBookingId === rejectModalBookingId}
              >
                {actingBookingId === rejectModalBookingId ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  accent?: 'gold' | 'dark' | 'danger';
}

function StatCard({ label, value, accent }: StatCardProps) {
  const borderClass =
    accent === 'gold'
      ? 'border-gold/40 bg-gold-muted'
      : accent === 'dark'
      ? 'border-charcoal bg-charcoal text-cream'
      : accent === 'danger'
      ? 'border-red-200 bg-red-50'
      : 'border-stone bg-cream-50';

  const labelClass = accent === 'dark' ? 'text-cream/60' : 'text-charcoal-400';
  const valueClass = accent === 'dark' ? 'text-cream' : 'text-charcoal';

  return (
    <div className={`border p-4 ${borderClass}`}>
      <p className={`text-[0.625rem] uppercase tracking-[0.2em] ${labelClass}`}>{label}</p>
      <p className={`mt-2 font-display text-3xl ${valueClass}`}>{value}</p>
    </div>
  );
}
