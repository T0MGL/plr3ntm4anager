import { api } from '../utils/api';

export interface OpsEvent {
  date: string;
  unit_id: string;
  unit_name: string;
  guest_label: string;
  source: 'widget' | 'airbnb';
  availability_id: string | null;
  booking_id: string | null;
}

export interface OpsTurnover {
  unit_id: string;
  unit_name: string;
  outgoing: OpsEvent;
  incoming: OpsEvent;
}

export interface OpsVacantUnit {
  unit_id: string;
  unit_name: string;
}

export interface OpsOverview {
  today: string;
  horizon: string;
  upcoming_checkins: OpsEvent[];
  upcoming_checkouts: OpsEvent[];
  turnover_today: OpsTurnover[];
  vacant_now: OpsVacantUnit[];
}

export async function fetchOpsOverview(): Promise<OpsOverview> {
  const { data } = await api.get<OpsOverview>('/admin/ops-overview');
  return data;
}

export interface SyncUnitStatus {
  unit_id: string;
  name: string;
  status: string;
  last_synced_at: string | null;
  last_status: string | null;
  last_completed_at: string | null;
}

export async function fetchSyncUnitStatus(): Promise<SyncUnitStatus[]> {
  const { data } = await api.get<SyncUnitStatus[]>('/admin/sync/unit-status');
  return data;
}

export async function triggerManualSync(unitId?: string): Promise<void> {
  await api.post('/admin/sync/manual', unitId ? { unit_id: unitId } : {});
}
