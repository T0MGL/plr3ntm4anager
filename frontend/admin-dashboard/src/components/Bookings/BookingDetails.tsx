import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
    <div className="grid gap-4 text-sm text-charcoal-500">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow label="Huesped" value={booking.guest_name} />
        <DetailRow label="Correo" value={booking.guest_email} />
        <DetailRow label="Telefono" value={booking.guest_phone} />
        <DetailRow label="Estado" value={booking.status} />
      </div>

      <div className="border border-stone bg-cream px-4 py-3">
        <p>
          <span className="text-[0.625rem] uppercase tracking-[0.2em] text-charcoal-400">Estancia</span>
          <br />
          <span className="text-charcoal">
            {booking.check_in_date} al {booking.check_out_date}
          </span>
        </p>
        <p className="mt-3">
          <span className="text-[0.625rem] uppercase tracking-[0.2em] text-charcoal-400">Total</span>
          <br />
          <span className="font-display text-2xl text-charcoal">
            ${booking.total_price_usd.toLocaleString('es-PY')}
          </span>
        </p>
        {booking.created_at ? (
          <p className="mt-3 text-[0.6875rem] text-charcoal-400">
            Solicitada el {format(new Date(booking.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
          </p>
        ) : null}
      </div>

      {booking.special_requests ? (
        <div className="border border-stone px-4 py-3">
          <p className="text-[0.625rem] uppercase tracking-[0.2em] text-gold">Solicitudes especiales</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal">{booking.special_requests}</p>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-[0.2em] text-charcoal-400">{label}</p>
      <p className="mt-1 text-sm text-charcoal">{value}</p>
    </div>
  );
}
