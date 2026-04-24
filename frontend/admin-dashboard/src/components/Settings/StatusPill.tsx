import { useTranslation } from 'react-i18next';

export type MemberStatus = 'active' | 'pending' | 'inactive';

interface StatusPillProps {
  status: MemberStatus;
}

const DOT: Record<MemberStatus, string> = {
  active: 'bg-emerald-500',
  pending: 'bg-amber-500',
  inactive: 'bg-slate-400',
};

// Neutral pill with a status dot. Same container for every state so the table
// does not flash between loud color blocks. The dot is the only differentiator.
export default function StatusPill({ status }: StatusPillProps) {
  const { t } = useTranslation();
  const textTone = status === 'inactive' ? 'text-slate-500' : 'text-slate-700';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium ${textTone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden="true" />
      {t(`team.status_${status}`)}
    </span>
  );
}
