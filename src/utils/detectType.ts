import type { ColumnType } from '../engine/types';

export function detectColumnType(values: (string | number | null)[]): ColumnType {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');

  if (nonNullValues.length === 0) return 'string';

  const sampleSize = Math.min(nonNullValues.length, 100);
  const samples = nonNullValues.slice(0, sampleSize);

  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;

  for (const raw of samples) {
    const v = String(raw).trim();

    if (v === '' || v === 'null' || v === 'NULL' || v === 'undefined' || v === 'NaN') continue;

    if (/^(true|false|yes|no|是|否|TRUE|FALSE|YES|NO)$/i.test(v)) {
      booleanCount++;
      continue;
    }

    if (!isNaN(Number(v)) && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v)) {
      numberCount++;
      continue;
    }

    if (isDateString(v)) {
      dateCount++;
      continue;
    }
  }

  const total = samples.length;
  const numberRatio = numberCount / total;
  const dateRatio = dateCount / total;
  const booleanRatio = booleanCount / total;

  if (booleanRatio >= 0.8) return 'boolean';
  if (numberRatio >= 0.8) return 'number';
  if (dateRatio >= 0.8) return 'date';
  if (numberRatio > 0.1 || dateRatio > 0.1 || booleanRatio > 0.1) return 'mixed';
  return 'string';
}

function isDateString(v: string): boolean {
  if (v.length < 6 || v.length > 30) return false;

  const datePatterns = [
    /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?$/,
    /^\d{1,2}[-/月]\d{1,2}[-/年]\d{4}年?$/,
    /^\d{4}\d{2}\d{2}$/,
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[ T]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
  ];

  for (const pattern of datePatterns) {
    if (pattern.test(v)) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return true;
    }
  }

  return false;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(n);
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isNullish(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' || s === 'null' || s === 'NULL' || s === 'NaN' || s === 'undefined' || s === '-' || s === '/';
  }
  return false;
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
