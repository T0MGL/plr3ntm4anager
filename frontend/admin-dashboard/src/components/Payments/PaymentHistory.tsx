import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../../utils/api';
import { supabase } from '../../context/AuthContext';

interface PaymentRow {
  id: string;
  booking_id: string;
  amount_usd: number;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | string;
  payment_method: string | null;
  bancard_transaction_id: string | null;
  failure_reason?: string | null;
  created_at: string;
}

function statusChipClass(status: string): string {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'refunded') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async (statusFilter?: string) => {
    const { data } = await api.get<PaymentRow[]>('/admin/payments', {
      params: statusFilter ? { status: statusFilter, limit: 100 } : { limit: 100 },
    });
    setPayments(data ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await fetchPayments(status || undefined);
        setError(null);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load payments';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [status]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        void fetchPayments(status || undefined);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [status]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return payments;

    return payments.filter((payment) => {
      return (
        payment.booking_id.toLowerCase().includes(term) ||
        payment.id.toLowerCase().includes(term) ||
        (payment.bancard_transaction_id ?? '').toLowerCase().includes(term) ||
        (payment.payment_method ?? '').toLowerCase().includes(term)
      );
    });
  }, [payments, search]);

  const summary = useMemo(() => {
    return filteredPayments.reduce(
      (acc, payment) => {
        acc.totalCount += 1;
        acc.totalAmount += Number(payment.amount_usd || 0);

        if (payment.payment_status === 'completed') {
          acc.completed += 1;
          acc.completedAmount += Number(payment.amount_usd || 0);
        }
        if (payment.payment_status === 'failed') acc.failed += 1;
        if (payment.payment_status === 'pending') acc.pending += 1;
        if (payment.payment_status === 'refunded') acc.refunded += 1;
        return acc;
      },
      {
        totalCount: 0,
        totalAmount: 0,
        completed: 0,
        completedAmount: 0,
        failed: 0,
        pending: 0,
        refunded: 0,
      },
    );
  }, [filteredPayments]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payments</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.totalCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Completed</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{summary.completed}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700">Pending</p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{summary.pending}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-700">Failed</p>
          <p className="mt-1 text-xl font-semibold text-rose-800">{summary.failed}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <p className="text-xs uppercase tracking-wide text-sky-700">Completed volume</p>
          <p className="mt-1 text-xl font-semibold text-sky-800">${summary.completedAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search booking ID, payment ID, transaction ID"
          className="w-full min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>

        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          onClick={() => void fetchPayments(status || undefined)}
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {isLoading ? <p className="text-sm text-slate-500">Loading payments...</p> : null}

        {!isLoading && filteredPayments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments found for current filters.</p>
        ) : null}

        {!isLoading && filteredPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Booking</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Transaction</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Failure reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusChipClass(payment.payment_status)}`}>
                        {payment.payment_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 font-medium text-slate-900">${payment.amount_usd}</td>
                    <td className="max-w-[220px] py-2 pr-4 text-xs text-slate-600" title={payment.booking_id}>{payment.booking_id}</td>
                    <td className="py-2 pr-4 text-slate-600">{payment.payment_method ?? '-'}</td>
                    <td className="max-w-[220px] py-2 pr-4 text-xs text-slate-600" title={payment.bancard_transaction_id ?? '-'}>
                      {payment.bancard_transaction_id ?? '-'}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}</td>
                    <td className="max-w-[220px] py-2 text-xs text-rose-700">{payment.failure_reason ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
