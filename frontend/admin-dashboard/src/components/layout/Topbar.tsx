import { FiGrid } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

interface TopbarProps {
  userEmail?: string;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export default function Topbar({ userEmail, onMenuClick, onSignOut }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.resolvedLanguage ?? i18n.language).startsWith('es') ? 'es' : 'en';

  const toggleLang = () => {
    i18n.changeLanguage(currentLang === 'es' ? 'en' : 'es');
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur sm:px-6"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] lg:hidden"
          onClick={onMenuClick}
          aria-label={t('layout.openNav')}
        >
          <FiGrid className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <div>
          <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-[#6B7280]">Park Lofts</p>
          <h2 className="m-0 text-lg font-semibold text-[#111827] sm:text-[20px]">
            {t('layout.rentAdmin')}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#374151] transition-colors hover:bg-[#F3F4F6]"
          onClick={toggleLang}
          aria-label="Switch language"
        >
          {currentLang === 'es' ? 'EN' : 'ES'}
        </button>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F3F4F6]"
          onClick={onSignOut}
          aria-label={userEmail ? `${t('layout.logout')} ${userEmail}` : t('layout.logout')}
        >
          {t('layout.logout')}
        </button>
      </div>
    </header>
  );
}
