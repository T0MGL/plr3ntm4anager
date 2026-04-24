import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiDollarSign, FiLoader, FiSave, FiSettings, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { useAdminRole } from '../hooks/useAdminRole';
import { useAuth } from '../context/AuthContext';
import TeamMembersSection from '../components/Settings/TeamMembersSection';
import FxRateSection from '../components/Settings/FxRateSection';
import AccountSection from '../components/Settings/AccountSection';
import SystemInfoSection from '../components/Settings/SystemInfoSection';

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

type GeneralStatus = 'loading' | 'ready' | 'saving' | 'error';
type TabKey = 'general' | 'fx' | 'team';

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, role, status: roleStatus } = useAdminRole();
  const [tab, setTab] = useState<TabKey>('general');
  const [generalStatus, setGeneralStatus] = useState<GeneralStatus>('loading');
  const [airbnbHostId, setAirbnbHostId] = useState('');
  const [savedAirbnbHostId, setSavedAirbnbHostId] = useState('');
  const [fieldError, setFieldError] = useState('');
  const tabListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      setGeneralStatus('loading');
      try {
        const { data } = await api.get<SettingRow[]>('/admin/settings');
        const hostRow = data.find((r) => r.key === 'airbnb_host_id');
        const hostId = hostRow?.value ?? '';
        setAirbnbHostId(hostId);
        setSavedAirbnbHostId(hostId);
        setGeneralStatus('ready');
      } catch {
        setGeneralStatus('error');
      }
    };
    void load();
  }, []);

  const save = async () => {
    const trimmed = airbnbHostId.trim();
    if (!trimmed) {
      setFieldError(t('settings.errorHostIdRequired'));
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setFieldError(t('settings.errorHostIdNumeric'));
      return;
    }
    setFieldError('');
    setGeneralStatus('saving');
    try {
      await api.patch('/admin/settings', [{ key: 'airbnb_host_id', value: trimmed }]);
      setSavedAirbnbHostId(trimmed);
      setGeneralStatus('ready');
      toast.success(t('settings.saved'));
    } catch {
      setGeneralStatus('ready');
      toast.error(t('settings.saveFailed'));
    }
  };

  const isDirty = airbnbHostId.trim() !== savedAirbnbHostId;
  const tabs: Array<{ key: TabKey; label: string; icon: typeof FiSettings; visible: boolean }> = [
    { key: 'general', label: t('settings.tabGeneral'), icon: FiSettings, visible: true },
    { key: 'fx', label: t('settings.tabFx'), icon: FiDollarSign, visible: isAdmin },
    { key: 'team', label: t('settings.tabTeam'), icon: FiUsers, visible: isAdmin },
  ];
  const visibleTabs = tabs.filter((tabItem) => tabItem.visible);

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const last = visibleTabs.length - 1;
    let next = index;
    if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    setTab(visibleTabs[next].key);
    const btns = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    btns?.[next]?.focus();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('settings.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('settings.subtitle')}</p>
      </header>

      <div className="border-b border-slate-200">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label={t('settings.title')}
          className="-mb-px flex flex-wrap items-center gap-1 sm:gap-2"
        >
          {visibleTabs.map((tabItem, index) => {
            const Icon = tabItem.icon;
            const active = tab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(tabItem.key)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
                className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 sm:px-4 ${
                  active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tabItem.label}
              </button>
            );
          })}
          {!isAdmin && roleStatus === 'ready' ? (
            <span
              className="ml-auto hidden rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:inline-flex"
              title={t('settings.teamAdminOnlyHint')}
            >
              {t('settings.teamAdminOnlyBadge')}
            </span>
          ) : null}
        </div>
      </div>

      {tab === 'general' ? (
        <div className="space-y-5">
          {generalStatus === 'loading' ? (
            <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('common.loading')}
            </div>
          ) : null}

          {generalStatus === 'error' ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {t('settings.loadFailed')}
            </div>
          ) : null}

          {generalStatus === 'ready' || generalStatus === 'saving' ? (
            <>
              <AccountSection user={user} role={role} roleStatus={roleStatus} />

              <section className="rounded-3xl border border-slate-200 bg-white p-6 space-y-5">
                <header>
                  <h3 className="text-base font-semibold text-slate-900">
                    {t('settings.airbnbSection')}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500">{t('settings.airbnbSectionDesc')}</p>
                </header>

                <div>
                  <label
                    htmlFor="airbnb-host-id"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    {t('settings.airbnbHostIdLabel')}
                  </label>
                  <input
                    id="airbnb-host-id"
                    type="text"
                    inputMode="numeric"
                    placeholder="744342154"
                    value={airbnbHostId}
                    onChange={(e) => {
                      setAirbnbHostId(e.target.value);
                      if (fieldError) setFieldError('');
                    }}
                    disabled={generalStatus === 'saving'}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 ${
                      fieldError
                        ? 'border-rose-300 bg-rose-50'
                        : 'border-slate-300 bg-white hover:border-slate-400'
                    }`}
                  />
                  {fieldError ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldError}</p>
                  ) : (
                    <p className="mt-1.5 text-xs text-slate-500">{t('settings.airbnbHostIdHint')}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                    onClick={() => void save()}
                    disabled={generalStatus === 'saving' || !isDirty}
                  >
                    {generalStatus === 'saving' ? (
                      <>
                        <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {t('settings.saving')}
                      </>
                    ) : (
                      <>
                        <FiSave className="h-4 w-4" aria-hidden="true" />
                        {t('settings.save')}
                      </>
                    )}
                  </button>
                </div>
              </section>

              <SystemInfoSection />
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'fx' ? (
        roleStatus === 'loading' ? (
          <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : !isAdmin ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t('settings.fxAdminOnlyMessage')}
          </div>
        ) : (
          <FxRateSection />
        )
      ) : null}

      {tab === 'team' ? (
        roleStatus === 'loading' ? (
          <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : !isAdmin ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t('settings.teamAdminOnlyMessage')}
          </div>
        ) : (
          <TeamMembersSection currentUserEmail={user?.email ?? null} />
        )
      ) : null}
    </div>
  );
}
