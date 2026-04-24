import { useTranslation } from 'react-i18next';
import type { AdminRole } from '../../services/admin-users';

interface RolePillProps {
  role: AdminRole;
}

// Neutral pill with a small colored dot. Keeps the visual language calm while
// still distinguishing admins (violet dot) from staff (slate dot).
export default function RolePill({ role }: RolePillProps) {
  const { t } = useTranslation();
  const dotColor = role === 'admin' ? 'bg-violet-500' : 'bg-slate-400';
  const label = role === 'admin' ? t('team.roleAdmin') : t('team.roleStaff');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      {label}
    </span>
  );
}
