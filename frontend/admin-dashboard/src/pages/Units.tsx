import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import UnitList, { UnitRow } from '../components/Units/UnitList';
import CreationFlow from '../components/creation/creation/CreationFlow';
import { CreationProvider } from '../context/CreationContext';

export default function Units() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [unitsRefreshKey, setUnitsRefreshKey] = useState(0);

  const closeModal = (shouldRefresh = false) => {
    setShowCreate(false);
    setEditingUnit(null);
    if (shouldRefresh) {
      setUnitsRefreshKey((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#222222]">{t('units.title')}</h2>
          <p className="mt-1 text-sm text-[#717171]">{t('units.subtitle')}</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setShowCreate(true)}>
          {t('units.createUnit')}
        </button>
      </div>

      <UnitList onEditUnit={(unit) => setEditingUnit(unit)} refreshKey={unitsRefreshKey} />

      {(showCreate || editingUnit) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
          onClick={() => closeModal()}
        >
          <div
            className="relative h-[86vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#ebebeb] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.16)] sm:h-[88vh] lg:h-[84vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <CreationProvider>
              <CreationFlow mode="admin-unit" onClose={closeModal} unitDraft={editingUnit as any} />
            </CreationProvider>
          </div>
        </div>
      )}
    </div>
  );
}
