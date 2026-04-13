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
  };
}

export default function BookingDetails({ booking }: BookingDetailsProps) {
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
          <span className="font-medium text-slate-900">Stay:</span> {booking.check_in_date} to {booking.check_out_date}
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

      {booking.special_requests ? (
        <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Special requests</p>
          <p className="mt-1 whitespace-pre-wrap">{booking.special_requests}</p>
        </div>
      ) : null}
    </div>
  );
}
