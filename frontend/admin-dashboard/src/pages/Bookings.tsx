import { useTranslation } from 'react-i18next';
import BookingList from '../components/Bookings/BookingList';

export default function Bookings() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{t('bookings.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('bookings.subtitle')}</p>
      </div>
      <BookingList />
    </div>
  );
}
