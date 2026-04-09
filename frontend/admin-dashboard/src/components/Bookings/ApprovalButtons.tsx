interface ApprovalButtonsProps {
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export default function ApprovalButtons({ onApprove, onReject, isLoading = false }: ApprovalButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        className="border border-charcoal bg-charcoal px-6 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-cream transition-all duration-300 hover:bg-gold hover:border-gold hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onApprove}
        disabled={isLoading}
      >
        {isLoading ? 'Procesando...' : 'Aprobar'}
      </button>
      <button
        className="border border-charcoal/30 px-6 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-charcoal-500 transition-all duration-300 hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onReject}
        disabled={isLoading}
      >
        Rechazar
      </button>
    </div>
  );
}
