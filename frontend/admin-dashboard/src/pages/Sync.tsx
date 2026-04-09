import SyncStatus from '../components/Sync/SyncStatus';
import SyncLogs from '../components/Sync/SyncLogs';

export default function Sync() {
  return (
    <div className="grid gap-5 md:gap-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Availability Sync</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Monitor iCal synchronization health and run manual sync operations.
        </p>
      </div>
      <SyncStatus />
      <SyncLogs />
    </div>
  );
}
