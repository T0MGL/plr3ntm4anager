import PaymentHistory from '../components/Payments/PaymentHistory';

export default function Payments() {
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Payments & Reconciliation</h2>
        <p className="mt-1 text-sm text-slate-500">
          Track payment outcomes, investigate failed charges, and verify transaction records.
        </p>
      </div>
      <PaymentHistory />
    </div>
  );
}
