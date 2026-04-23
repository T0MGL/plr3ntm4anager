import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import UnitCard from './UnitCard';
import IcalFeedPanel from './IcalFeedPanel';
import { api } from '../../utils/api';
import { supabase } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export interface UnitRow {
  id: string;
  name: string;
  nightly_rate_usd: number;
  status: string;
  description: string | null;
  max_guests: number;
  airbnb_listing_url: string | null;
  airbnb_ical_url: string;
  ical_feed_token: string;
  image_urls: string[] | null;
  category?: string | null;
  place_type?: string | null;
  country?: string | null;
  street_address?: string | null;
  floor?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  home_precise?: boolean | null;
  bedroom_lock?: boolean | null;
  private_bathroom?: number | null;
  dedicated_bathroom?: number | null;
  shared_bathroom?: number | null;
  bathroom_usage?: string | null;
  favorites?: string[] | null;
  amenities?: string[] | null;
  safety_items?: string[] | null;
  highlights?: string[] | null;
  safety_details?: string[] | null;
  weekday_price?: number | null;
  weekday_after_tax_price?: number | null;
  bedrooms?: number | null;
  beds?: number | null;
  bedroom_count?: number | null;
  bed_count?: number | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string | null;
}

interface UnitListProps {
  onEditUnit?: (unit: UnitRow) => void;
  refreshKey?: number;
}

export default function UnitList({ onEditUnit, refreshKey = 0 }: UnitListProps) {
  const { t } = useTranslation();
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [unitPendingDelete, setUnitPendingDelete] = useState<UnitRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUnits = async () => {
    const { data } = await api.get<UnitRow[]>('/admin/units');
    setUnits(data);
  };

  const getUnitById = async (unitId: string) => {
    const { data } = await api.get<UnitRow>(`/admin/units/${unitId}`);
    return data;
  };

  useEffect(() => {
    void fetchUnits();
  }, [refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-units')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => {
        void fetchUnits();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const requestDelete = (unit: UnitRow) => {
    setUnitPendingDelete(unit);
  };

  const confirmDelete = async () => {
    if (!unitPendingDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/admin/units/${unitPendingDelete.id}`);
      toast.success(t('unitList.deleted'));
      setUnitPendingDelete(null);
      await fetchUnits();
    } catch (error) {
      console.error('Failed to delete unit:', error);
      toast.error(t('unitList.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (units.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-black/15 bg-white p-12 text-center">
        <h3 className="text-lg font-semibold text-[#222222]">{t('unitList.noUnits')}</h3>
        <p className="mt-2 text-sm text-[#717171]">{t('unitList.noUnitsDesc')}</p>
      </div>
    );
  }

  return (
    <>
      <section className="space-y-4" aria-label="Unit listings">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => (
            <div key={unit.id} className="group flex flex-col overflow-hidden rounded-[24px] border border-[#ebebeb] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <UnitCard
                name={unit.name}
                description={unit.description}
                imageUrl={unit.image_urls?.[0] ?? null}
                nightlyRate={unit.nightly_rate_usd}
                maxGuests={unit.max_guests}
                status={unit.status}
                onEdit={async () => {
                  if (!onEditUnit) {
                    return;
                  }

                  try {
                    const freshUnit = await getUnitById(unit.id);
                    onEditUnit(freshUnit);
                  } catch (error) {
                    console.error('Failed to load unit details:', error);
                    toast.error(t('unitList.loadFailed'));
                  }
                }}
                onDelete={() => requestDelete(unit)}
              />
              {unit.ical_feed_token && (
                <div className="border-t border-[#f0f0f0] px-5 py-2.5">
                  <IcalFeedPanel
                    unitId={unit.id}
                    icalFeedToken={unit.ical_feed_token}
                    onTokenRotated={(newToken) =>
                      setUnits((prev) =>
                        prev.map((u) => (u.id === unit.id ? { ...u, ical_feed_token: newToken } : u))
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {unitPendingDelete && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isDeleting) {
              setUnitPendingDelete(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#222222]">{t('unitList.deleteTitle')}</h3>
            <p className="mt-2 text-sm text-[#6a6a6a]">
              {t('unitList.deleteConfirm', { name: unitPendingDelete.name })}
            </p>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-[#dddddd] px-4 py-2 text-sm font-medium text-[#484848] hover:bg-[#f7f7f7]"
                onClick={() => setUnitPendingDelete(null)}
                disabled={isDeleting}
              >
                {t('unitList.cancel')}
              </button>
              <button
                type="button"
                className="rounded-full bg-[#e31c5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c71752] disabled:opacity-60"
                onClick={() => void confirmDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? t('unitList.deleting') : t('unitList.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
