import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface BookingDetailsProps {
  booking: {
    id: string;
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

export default function BookingDetails({ booking }: BookingDetailsProps) {
  const { t } = useTranslation();

  const approvalPath = booking.approval_path ?? null;
  const reason = booking.approval_decision_reason ?? null;
  const syncAge = booking.sync_age_minutes_at_decision ?? null;

  const reasonLabel = reason
    ? (t(`bookingDetails.reasons.${reason}`, { defaultValue: reason }) as string)
    : null;

  return (
    <div className="grid gap-3 text-sm text-slate-700">
      <div className="grid gap-1 sm:grid-cols-2">
        <p>
          <span className="font-medium text-slate-900">{t('bookingDetails.guest')}</span>{' '}
          {booking.guest_name}
        </p>
        <p>
          <span className="font-medium text-slate-900">{t('bookingDetails.email')}</span>{' '}
          <a href={`mailto:${booking.guest_email}`} className="text-blue-600 hover:underline">
            {booking.guest_email}
          </a>
        </p>
        <p>
          <span className="font-medium text-slate-900">{t('bookingDetails.phone')}</span>{' '}
          <a href={`tel:${booking.guest_phone}`} className="text-blue-600 hover:underline">
            {booking.guest_phone}
          </a>
        </p>
        <p>
          <span className="font-medium text-slate-900">{t('bookingDetails.status')}</span>{' '}
          {booking.status}
        </p>
        <p>
          <span className="font-medium text-slate-900">{t('bookingDetails.reference', { defaultValue: 'Ref.' })}</span>{' '}
          <span className="font-mono tracking-wide">{booking.id.slice(0, 8).toUpperCase()}</span>
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-slate-700">
        <p>
          <span className="font-medium text-slate-900">{t('bookingDetails.stay')}</span>{' '}
          {booking.check_in_date} {t('bookingDetails.to')} {booking.check_out_date}
        </p>
        <p className="mt-1">
          <span className="font-medium text-slate-900">{t('bookingDetails.total')}</span> $
          {booking.total_price_usd}
        </p>
        {booking.created_at ? (
          <p className="mt-1 text-xs text-slate-500">
            {t('bookingDetails.requestedOn', {
              date: format(new Date(booking.created_at), 'MMM dd, yyyy HH:mm'),
            })}
          </p>
        ) : null}
      </div>

      {approvalPath ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t('bookingDetails.approvalRouting')}
          </p>
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-900">{t('bookingDetails.path')}</dt>
              <dd className="mt-0.5 capitalize">{approvalPath}</dd>
            </div>
            {reasonLabel ? (
              <div>
                <dt className="font-medium text-slate-900">{t('bookingDetails.reason')}</dt>
                <dd className="mt-0.5">{reasonLabel}</dd>
              </div>
            ) : null}
            {syncAge !== null ? (
              <div>
                <dt className="font-medium text-slate-900">{t('bookingDetails.syncAge')}</dt>
                <dd className="mt-0.5">
                  {t('bookingDetails.syncAgeValue', {
                    minutes: syncAge,
                    label:
                      syncAge > 60
                        ? `${Math.round(syncAge / 60)}${t('bookingDetails.hours')}`
                        : t('bookingDetails.recent'),
                  })}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {booking.special_requests ? (
        <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{t('bookingDetails.specialRequests')}</p>
          <p className="mt-1 whitespace-pre-wrap">{booking.special_requests}</p>
        </div>
      ) : null}
    </div>
  );
}
