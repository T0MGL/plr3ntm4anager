import { FiEdit2, FiTrash2, FiUsers } from 'react-icons/fi';

interface UnitCardProps {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  nightlyRate: number;
  maxGuests?: number | null;
  status: string;
  onEdit?: () => void;
  onDelete: () => void;
}

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function UnitCard({
  name,
  description,
  imageUrl,
  nightlyRate,
  maxGuests,
  status,
  onEdit,
  onDelete,
}: UnitCardProps) {
  const normalizedStatus = status.toLowerCase();
  const statusClassName = statusStyles[normalizedStatus] ?? 'bg-sky-50 text-sky-700 border-sky-200';

  return (
    <article className="group overflow-hidden rounded-[24px] border border-[#ebebeb] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${name} preview`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f7f7f7] via-white to-[#f2f2f2]">
            <p className="text-sm font-medium tracking-wide text-[#8a8a8a]">No image</p>
          </div>
        )}
        <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClassName}`}>
          {status}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[#222222]">{name}</h3>
          <p className="min-h-10 text-sm leading-5 text-[#6a6a6a]">
            {description?.trim() ? description : 'No description added yet for this unit.'}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-[#222222]">${nightlyRate}/night</p>
          {typeof maxGuests === 'number' && (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6a6a6a]">
              <FiUsers className="h-3.5 w-3.5" aria-hidden="true" />
              {maxGuests} guests
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          {onEdit && (
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#dddddd] bg-white px-4 py-2.5 text-sm font-semibold text-[#484848] transition-colors duration-200 hover:border-[#cfcfcf] hover:bg-[#f7f7f7]"
              onClick={onEdit}
              aria-label={`Edit ${name}`}
            >
              <FiEdit2 className="h-4 w-4" aria-hidden="true" />
              Edit
            </button>
          )}
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#ffd6df] bg-[#fff5f8] px-4 py-2.5 text-sm font-semibold text-[#c1355b] transition-colors duration-200 hover:bg-[#ffe9ef]"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
          >
            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
