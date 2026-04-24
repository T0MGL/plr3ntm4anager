import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import BookingList, { type BookingListHandle } from '../components/Bookings/BookingList';
import OpsDashboard from '../components/Bookings/OpsDashboard';

export default function Bookings() {
  const { t } = useTranslation();
  const listRef = useRef<BookingListHandle>(null);

  // Gaston approved: the "Reserva manual" CTA reuses the existing booking
  // flow. The admin booking flow IS the public widget flow, so we open
  // the widget's unit detail page (pre-pointed to the unit) in a new tab.
  // The admin picks dates there and completes the booking as a guest
  // would, which also exercises the same availability, preauth and
  // email paths the production system depends on.
  const onCreateManualBooking = (unitId: string) => {
    const base = import.meta.env.VITE_WIDGET_URL ?? 'http://localhost:5173';
    const url = `${base.replace(/\/$/, '')}/units/${unitId}`;
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      toast.error(
        t('bookings.widgetOpenFailed', {
          defaultValue: 'No se pudo abrir el widget. Revisá el bloqueador de pop-ups.'
        })
      );
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{t('bookings.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('bookings.subtitle')}</p>
      </div>
      <OpsDashboard
        onSelectBooking={(id) => listRef.current?.focusBooking(id)}
        onSelectAirbnb={(id) => listRef.current?.focusAvailability(id)}
        onCreateManualBooking={onCreateManualBooking}
      />
      <BookingList ref={listRef} />
    </div>
  );
}
