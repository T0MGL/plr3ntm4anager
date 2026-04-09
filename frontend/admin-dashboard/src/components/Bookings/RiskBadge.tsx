interface RiskBadgeProps {
  riskIndex: number | null;
}

interface RiskLevel {
  label: string;
  className: string;
  description: string;
}

function resolveLevel(riskIndex: number | null): RiskLevel | null {
  if (riskIndex == null) {
    return {
      label: 'Riesgo s/d',
      className: 'border-stone bg-cream-50 text-charcoal-400',
      description: 'Sin evaluacion disponible',
    };
  }

  if (riskIndex <= 3) {
    return {
      label: `Bajo ${riskIndex}`,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      description: 'Riesgo bajo',
    };
  }

  if (riskIndex <= 6) {
    return {
      label: `Medio ${riskIndex}`,
      className: 'border-amber-300 bg-amber-50 text-amber-800',
      description: 'Riesgo medio',
    };
  }

  return {
    label: `Alto ${riskIndex}`,
    className: 'border-red-300 bg-red-50 text-red-800',
    description: 'Revisar antes de aprobar',
  };
}

export default function RiskBadge({ riskIndex }: RiskBadgeProps) {
  const level = resolveLevel(riskIndex);
  if (!level) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-3 py-1 text-[0.625rem] font-medium uppercase tracking-[0.2em] ${level.className}`}
      title={level.description}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {level.label}
    </span>
  );
}
