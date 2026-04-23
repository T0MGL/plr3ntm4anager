import { api } from '../utils/api';

export interface CsvExportFilters {
  from?: string;
  to?: string;
  status?: string;
  unitId?: string;
}

type ExportKind = 'payments' | 'bookings';

const PATHS: Record<ExportKind, string> = {
  payments: '/admin/payments/export.csv',
  bookings: '/admin/bookings/export.csv'
};

// Downloads a CSV via the authenticated axios client (we cannot use a plain
// anchor href because the API requires the Authorization header). Reads the
// response as a Blob, then triggers a download by appending an anchor and
// revoking the object URL on the next tick.
export async function downloadCsv(kind: ExportKind, filters: CsvExportFilters): Promise<void> {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.status) params.status = filters.status;
  if (filters.unitId) params.unit_id = filters.unitId;

  const response = await api.get<Blob>(PATHS[kind], {
    params,
    responseType: 'blob'
  });

  const fallbackName = `${kind}_${new Date().toISOString().slice(0, 10)}.csv`;
  const filename = parseFilename(response.headers['content-disposition']) ?? fallbackName;

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function parseFilename(headerValue: unknown): string | null {
  if (typeof headerValue !== 'string') return null;
  const match = /filename="?([^";]+)"?/i.exec(headerValue);
  return match?.[1] ?? null;
}
