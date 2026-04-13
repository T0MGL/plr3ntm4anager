interface ApprovalButtonsProps {
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export default function ApprovalButtons({ onApprove, onReject, isLoading = false }: ApprovalButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onApprove}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Approve'}
      </button>
      <button
        className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onReject}
        disabled={isLoading}
      >
        Reject
      </button>
    </div>
  );
}
