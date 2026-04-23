import { useTranslation } from 'react-i18next';

interface RiskBadgeProps {
  riskIndex: number | null;
}

export default function RiskBadge({ riskIndex }: RiskBadgeProps) {
  const { t } = useTranslation();

  let label: string;
  let className: string;
  let description: string;

  if (riskIndex == null) {
    label = t('risk.na');
    className = 'border-stone bg-cream-50 text-charcoal-400';
    description = t('risk.naDesc');
  } else if (riskIndex <= 3) {
    label = t('risk.low', { index: riskIndex });
    className = 'border-emerald-200 bg-emerald-50 text-emerald-800';
    description = t('risk.lowDesc');
  } else if (riskIndex <= 6) {
    label = t('risk.medium', { index: riskIndex });
    className = 'border-amber-300 bg-amber-50 text-amber-800';
    description = t('risk.mediumDesc');
  } else {
    label = t('risk.high', { index: riskIndex });
    className = 'border-red-300 bg-red-50 text-red-800';
    description = t('risk.highDesc');
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-3 py-1 text-[0.625rem] font-medium uppercase tracking-[0.2em] ${className}`}
      title={description}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {label}
    </span>
  );
}
