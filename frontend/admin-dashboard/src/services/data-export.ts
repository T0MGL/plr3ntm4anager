import { api } from '../utils/api';

export type ExportKind = 'payments' | 'bookings';
export type ExportFormat = 'xlsx' | 'pdf';

export interface ExportFilters {
  from?: string;
  to?: string;
  status?: string;
  unitId?: string;
}

const PATHS: Record<ExportKind, string> = {
  payments: '/admin/payments/export.csv',
  bookings: '/admin/bookings/export.csv',
};

const SHEET_TITLES: Record<ExportKind, string> = {
  payments: 'Payments',
  bookings: 'Bookings',
};

// Reuses the backend CSV streamer (pages of 500 rows, unbounded) so the client
// never has to know about pagination while still getting the full dataset.
// The CSV text is parsed in memory and re-emitted as xlsx or pdf.
async function fetchRows(kind: ExportKind, filters: ExportFilters): Promise<string[][]> {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.status) params.status = filters.status;
  if (filters.unitId) params.unit_id = filters.unitId;

  const response = await api.get<Blob>(PATHS[kind], { params, responseType: 'blob' });
  const text = await response.data.text();
  return parseCsv(text);
}

// RFC 4180 parser. Quoted fields may contain commas, CR/LF, and doubled quotes
// as an escape. We only need to handle the output shape produced by the server
// in admin.routes.ts (csvEscape/csvLine).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      continue;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function exportXlsx(kind: ExportKind, filters: ExportFilters): Promise<void> {
  const [XLSX, rows] = await Promise.all([
    import('xlsx'),
    fetchRows(kind, filters),
  ]);
  if (rows.length === 0) throw new Error('No data to export');

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  const header = rows[0];
  sheet['!cols'] = header.map((_, colIdx) => {
    let max = 8;
    for (const r of rows) {
      const len = String(r[colIdx] ?? '').length;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, SHEET_TITLES[kind]);
  XLSX.writeFile(wb, `${kind}_${todayStamp()}.xlsx`);
}

async function exportPdf(kind: ExportKind, filters: ExportFilters): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }, rows] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    fetchRows(kind, filters),
  ]);
  if (rows.length === 0) throw new Error('No data to export');

  const [header, ...body] = rows;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const stamp = todayStamp();
  const filterParts: string[] = [];
  if (filters.status) filterParts.push(`status=${filters.status}`);
  if (filters.from) filterParts.push(`from=${filters.from}`);
  if (filters.to) filterParts.push(`to=${filters.to}`);
  if (filters.unitId) filterParts.push(`unit_id=${filters.unitId}`);
  const subtitle = `${stamp} · ${body.length} rows${filterParts.length ? ' · ' + filterParts.join(', ') : ''}`;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${SHEET_TITLES[kind]} export`, 40, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(subtitle, 40, 58);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [header],
    body,
    startY: 72,
    styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${kind}_${stamp}.pdf`);
}

export async function downloadExport(
  kind: ExportKind,
  format: ExportFormat,
  filters: ExportFilters,
): Promise<void> {
  if (format === 'xlsx') return exportXlsx(kind, filters);
  return exportPdf(kind, filters);
}
