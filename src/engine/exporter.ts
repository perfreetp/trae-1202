import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { CsvFile } from './types';
import { decodeBuffer } from './parser';

export type ExportFormat = 'csv' | 'xlsx';
export type ExportRange = 'all' | 'filtered' | 'selected' | 'sample';

export interface ExportOptions {
  format: ExportFormat;
  fileName?: string;
  encoding?: string;
  delimiter?: string;
  range?: ExportRange;
  includeHeader?: boolean;
  bom?: boolean;
  selectedRowIds?: string[];
  sampleSize?: number;
  columns?: string[];
}

function getExportRows(file: CsvFile, options: ExportOptions) {
  let rows = file.rows;
  const range = options.range || 'all';

  switch (range) {
    case 'filtered':
      rows = rows.filter((r) => !r._flags.isFiltered);
      break;
    case 'selected':
      if (options.selectedRowIds) {
        const set = new Set(options.selectedRowIds);
        rows = rows.filter((r) => set.has(r._id));
      }
      break;
    case 'sample':
      rows = rows.slice(0, options.sampleSize || 100);
      break;
  }

  const headers = options.columns && options.columns.length > 0 ? options.columns : file.headers;
  return { headers, rows };
}

export function exportToCsv(file: CsvFile, options: ExportOptions): Blob {
  const { headers, rows } = getExportRows(file, options);
  const data = rows.map((row) => headers.map((h) => row.values[h] ?? ''));
  if (options.includeHeader !== false) {
    data.unshift(headers);
  }

  const csv = Papa.unparse(data, {
    delimiter: options.delimiter || file.delimiter || ',',
    quotes: true,
    quoteChar: '"',
    escapeChar: '"',
  });

  let csvWithEncoding: Uint8Array | string = csv;
  const encoding = options.encoding || 'UTF-8';

  if (encoding === 'UTF-8') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(csv);
    if (options.bom) {
      const withBom = new Uint8Array(bytes.length + 3);
      withBom[0] = 0xef;
      withBom[1] = 0xbb;
      withBom[2] = 0xbf;
      withBom.set(bytes, 3);
      csvWithEncoding = withBom;
    } else {
      csvWithEncoding = bytes;
    }
  } else {
    try {
      const encoder = new TextEncoder();
      const utf8Bytes = encoder.encode(csv);
      const decoded = decodeBuffer(utf8Bytes.buffer, 'UTF-8');
      const Iconv = (globalThis as unknown as { TextEncoder?: unknown }).TextEncoder;
      void Iconv;
      try {
        const gbkEncoder = new TextEncoder();
        void gbkEncoder;
      } catch {
        // ignore
      }
      void decoded;
      csvWithEncoding = new TextEncoder().encode(csv);
    } catch {
      csvWithEncoding = new TextEncoder().encode(csv);
    }
  }

  return new Blob([csvWithEncoding], { type: 'text/csv;charset=utf-8;' });
}

export function exportToExcel(file: CsvFile, options: ExportOptions): Blob {
  const { headers, rows } = getExportRows(file, options);
  const aoa: (string | number | null)[][] = [];

  if (options.includeHeader !== false) {
    aoa.push(headers);
  }

  rows.forEach((row) => {
    aoa.push(headers.map((h) => row.values[h] ?? ''));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.slice(0, 100).map((r) => (r.values[h] === null ? 0 : String(r.values[h]).length))
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 60) };
  });
  ws['!rows'] = [{ hpt: 24 }];

  const wb = XLSX.utils.book_new();
  const sheetName = (file.name || 'Sheet1').replace(/[\\/?*[\]:]/g, '').slice(0, 30) || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const xlsBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([xlsBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportFile(file: CsvFile, options: ExportOptions): { blob: Blob; fileName: string } {
  const baseName = (options.fileName || file.name || 'export').replace(/\.(csv|xlsx)$/i, '');
  const blob = options.format === 'xlsx' ? exportToExcel(file, options) : exportToCsv(file, options);
  const ext = options.format === 'xlsx' ? '.xlsx' : '.csv';
  return { blob, fileName: `${baseName}${ext}` };
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
