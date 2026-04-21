import { format } from 'date-fns';

interface BookingDetailsProps {
  booking: {
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    check_in_date: string;
    check_out_date: string;
    total_price_usd: number;
    status: string;
    special_requests?: string | null;
    created_at?: string;
    approval_path?: 'auto' | 'manual' | null;
    approval_decision_reason?: string | null;
    sync_age_minutes_at_decision?: number | null;
  };
}

const REASON_LABELS: Record<string, string> = {
  fresh_sync_dates_free: 'Sync fresco, fechas libres',
  stale_sync: 'Sync antiguo al momento de decidir',
  no_sync_recorded: 'Sin sync previo registrado',
  inline_sync_failed: 'Inline sync falló al momento de decidir',
  dates_conflict: 'Conflicto de fechas detectado',
  availability_check_failed: 'Consulta de disponibilidad falló',
};

export default function BookingDetails({ booking }: BookingDetailsProps) {
  const approvalPath = booking.approval_path ?? null;
  const reason = booking.approval_decision_reason ?? null;
  const syncAge = booking.sync_age_minutes_at_decision ?? null;

  return (
    <div className="grid gap-3 text-sm text-slate-700">
      <div className="grid gap-1 sm:grid-cols-2">
        <p>
          <span className="font-medium text-slate-900">Guest:</span> {booking.guest_name}
        </p>
        <p>
          <span className="font-medium text-slate-900">Email:</span> {booking.guest_email}
        </p>
        <p>
          <span className="font-medium text-slate-900">Phone:</span> {booking.guest_phone}
        </p>
        <p>
          <span className="font-medium text-slate-900">Status:</span> {booking.status}
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-slate-700">
        <p>
          <span className="font-medium text-slate-900">Stay:</span> {booking.check_in_date} to{' '}
          {booking.check_out_date}
        </p>
        <p className="mt-1">
          <span className="font-medium text-slate-900">Total:</span> ${booking.total_price_usd}
        </p>
        {booking.created_at ? (
          <p className="mt-1 text-xs text-slate-500">
            Requested on {format(new Date(booking.created_at), 'MMM dd, yyyy HH:mm')}
          </p>
        ) : null}
      </div>

      {approvalPath ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Approval routing
          </p>
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-900">Path</dt>
              <dd className="mt-0.5 capitalize">{approvalPath}</dd>
            </div>
            {reason ? (
              <div>
                <dt className="font-medium text-slate-900">Reason</dt>
                <dd className="mt-0.5">{REASON_LABELS[reason] ?? reason}</dd>
              </div>
            ) : null}
            {syncAge !== null ? (
              <div>
                <dt className="font-medium text-slate-900">Sync age at decision</dt>
                <dd className="mt-0.5">
                  {syncAge} min ({syncAge > 60 ? `${Math.round(syncAge / 60)}h` : 'reciente'})
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {booking.special_requests ? (
        <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Special requests</p>
          <p className="mt-1 whitespace-pre-wrap">{booking.special_requests}</p>
        </div>
      ) : null}
    </div>
  );
}
