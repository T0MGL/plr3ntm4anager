import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiRefreshCw } from 'react-icons/fi';
import UnitList, { UnitRow } from '../components/Units/UnitList';
import UnitEditor from '../components/Units/UnitEditor';
import AirbnbSyncModal from '../components/Units/AirbnbSyncModal';
import CreationFlow from '../components/creation/creation/CreationFlow';
import { CreationProvider } from '../context/CreationContext';

export default function Units() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [unitsRefreshKey, setUnitsRefreshKey] = useState(0);

  const closeCreateModal = (shouldRefresh = false) => {
    setShowCreate(false);
    if (shouldRefresh) {
      setUnitsRefreshKey((prev) => prev + 1);
    }
  };

  const closeEditModal = (shouldRefresh = false) => {
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[#dddddd] bg-white px-4 py-2.5 text-sm font-medium text-[#484848] transition-colors hover:bg-[#f7f7f7]"
            onClick={() => setShowSyncModal(true)}
          >
            <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('units.syncAirbnb')}
          </button>
          <button className="primary-button" type="button" onClick={() => setShowCreate(true)}>
            {t('units.createUnit')}
          </button>
        </div>
      </div>

      <UnitList onEditUnit={(unit) => setEditingUnit(unit)} refreshKey={unitsRefreshKey} />

      <AnimatePresence>
        {showSyncModal && (
          <AirbnbSyncModal
            onClose={() => setShowSyncModal(false)}
            onImported={() => {
              setUnitsRefreshKey((prev) => prev + 1);
              setShowSyncModal(false);
            }}
          />
        )}
      </AnimatePresence>

      {showCreate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
          onClick={() => closeCreateModal()}
        >
          <div
            className="relative h-[86vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#ebebeb] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.16)] sm:h-[88vh] lg:h-[84vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <CreationProvider>
              <CreationFlow mode="admin-unit" onClose={closeCreateModal} unitDraft={null as any} />
            </CreationProvider>
          </div>
        </div>
      )}

      {editingUnit && <UnitEditor unit={editingUnit} onClose={closeEditModal} />}
    </div>
  );
}
