import { useTranslation } from 'react-i18next';
import PaymentHistory from '../components/Payments/PaymentHistory';

export default function Payments() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{t('payments.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('payments.subtitle')}</p>
      </div>
      <PaymentHistory />
    </div>
  );
}
