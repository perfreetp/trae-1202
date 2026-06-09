import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { CsvFile, ColumnInfo } from './types';
import { decodeBuffer } from './parser';
import { formatNumber } from '../utils/detectType';

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
  includeAuditReport?: boolean;
}

export interface AuditReportRow {
  category: string;
  metric: string;
  value: string;
  note?: string;
}

export interface AuditReport {
  rows: AuditReportRow[];
  summary: {
    totalRows: number;
    nullRows: number;
    duplicateRows: number;
    modifiedRows: number;
    leftOnlyRows: number;
    rightOnlyRows: number;
    typeAnomalyColumns: number;
  };
}

export function buildAuditReport(file: CsvFile): AuditReport {
  const rows: AuditReportRow[] = [];
  const totalRows = file.rowCount;
  const totalCols = file.headers.length;
  const totalCells = totalRows * totalCols;

  let filledCells = 0;
  file.rows.forEach((r) => {
    Object.values(r.values).forEach((v) => {
      if (v !== null && v !== undefined && v !== '') filledCells++;
    });
  });
  const nullCells = totalCells - filledCells;
  const completion = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  let nullRows = 0;
  let duplicateRows = 0;
  let modifiedRows = 0;
  let leftOnlyRows = 0;
  let rightOnlyRows = 0;
  let typeAnomalyCount = 0;
  const typeAnomalyCols: string[] = [];

  file.rows.forEach((r) => {
    if (r._flags.isNull) nullRows++;
    if (r._flags.isDuplicate) duplicateRows++;
    if (r._flags.diffStatus === 'modified') modifiedRows++;
    if (r._flags.diffStatus === 'left-only') leftOnlyRows++;
    if (r._flags.diffStatus === 'right-only') rightOnlyRows++;
  });

  file.columns.forEach((c: ColumnInfo) => {
    // 混合类型 = 类型异常；推断的数字列中非数字超过 10% 也算异常
    if (c.type === 'mixed') {
      typeAnomalyCount++;
      typeAnomalyCols.push(c.name);
    } else if (c.type === 'number' && c.nullCount !== undefined) {
      const nonNumeric = (c as any).nonNumericCount ?? 0;
      if (nonNumeric > 0 && nonNumeric / Math.max(totalRows, 1) > 0.1) {
        typeAnomalyCount++;
        typeAnomalyCols.push(c.name);
      }
    }
  });

  rows.push(
    { category: '📋 文件概览', metric: '文件名', value: file.name, note: '' },
    { category: '📋 文件概览', metric: '总行数', value: formatNumber(totalRows), note: '' },
    { category: '📋 文件概览', metric: '总列数', value: formatNumber(totalCols), note: '' },
    { category: '📋 文件概览', metric: '总单元格数', value: formatNumber(totalCells), note: '' },
    { category: '📋 文件概览', metric: '完整率', value: `${completion}%`, note: `${formatNumber(filledCells)} / ${formatNumber(totalCells)} 个单元格有值` },
    { category: '📋 文件概览', metric: '编码/分隔符', value: `${file.encoding ?? '未知'} / ${file.delimiter ?? ','}`, note: '' },
    { category: '⚠️ 数据质量', metric: '含空值的行', value: formatNumber(nullRows), note: nullRows > 0 ? '可在「清洗区 → 空值删除」批量处理' : '无空值行' },
    { category: '⚠️ 数据质量', metric: '空单元格总数', value: formatNumber(nullCells), note: `${totalCells > 0 ? ((nullCells / totalCells) * 100).toFixed(1) : 0}% 单元格缺失` },
    { category: '⚠️ 数据质量', metric: '重复行', value: formatNumber(duplicateRows), note: duplicateRows > 0 ? '可在「清洗区 → 去重」批量处理' : '无重复行' },
    { category: '⚠️ 数据质量', metric: '列类型异常数', value: formatNumber(typeAnomalyCount), note: typeAnomalyCols.length > 0 ? `异常列：${typeAnomalyCols.join('、')}` : '所有列类型均匀' },
    { category: '🔗 合并/比对追踪', metric: '匹配-修改行', value: formatNumber(modifiedRows), note: modifiedRows > 0 ? '两表都有但值有差异' : '无修改行' },
    { category: '🔗 合并/比对追踪', metric: '左独有行', value: formatNumber(leftOnlyRows), note: leftOnlyRows > 0 ? '仅在左表存在' : '无左独有' },
    { category: '🔗 合并/比对追踪', metric: '右独有行', value: formatNumber(rightOnlyRows), note: rightOnlyRows > 0 ? '仅在右表存在' : '无右独有' },
    { category: '🔗 合并/比对追踪', metric: '匹配-不变行', value: formatNumber(Math.max(0, totalRows - modifiedRows - leftOnlyRows - rightOnlyRows)), note: '两表完全一致的行' }
  );

  rows.push({ category: '📊 各列明细', metric: '（列名）', value: '类型 / 空值 / 唯一值', note: '以下按列展开' });
  file.columns.forEach((c: ColumnInfo) => {
    const label = `${c.type}${c.inferred ? '(推断)' : ''}`;
    const uniq = (c as any).uniqueCount ?? '-';
    rows.push({
      category: '📊 各列明细',
      metric: c.name,
      value: `${label} / 空值:${formatNumber(c.nullCount)} / 唯一:${uniq === '-' ? '-' : formatNumber(uniq)}`,
      note: c.type === 'mixed' ? '⚠️ 混合类型' : '',
    });
  });

  return {
    rows,
    summary: {
      totalRows,
      nullRows,
      duplicateRows,
      modifiedRows,
      leftOnlyRows,
      rightOnlyRows,
      typeAnomalyColumns: typeAnomalyCount,
    },
  };
}

function auditReportToAoa(report: AuditReport): (string | number)[][] {
  const aoa: (string | number)[][] = [['分类', '指标', '数值', '备注']];
  report.rows.forEach((r) => {
    aoa.push([r.category, r.metric, r.value, r.note ?? '']);
  });
  return aoa;
}

export function exportAuditReportToCsv(report: AuditReport, encoding: string = 'UTF-8', bom: boolean = true): Blob {
  const aoa = auditReportToAoa(report);
  const csv = Papa.unparse(aoa, { delimiter: ',', quotes: true, quoteChar: '"', escapeChar: '"' });
  const encoder = new TextEncoder();
  const bytes = encoder.encode(csv);
  let csvWithEncoding: Uint8Array = bytes;
  if (encoding === 'UTF-8' && bom) {
    const withBom = new Uint8Array(bytes.length + 3);
    withBom[0] = 0xef;
    withBom[1] = 0xbb;
    withBom[2] = 0xbf;
    withBom.set(bytes, 3);
    csvWithEncoding = withBom;
  }
  return new Blob([csvWithEncoding], { type: 'text/csv;charset=utf-8;' });
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

export function exportToExcel(file: CsvFile, options: ExportOptions, auditReport?: AuditReport): Blob {
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

  if (auditReport) {
    const auditAoa = auditReportToAoa(auditReport);
    const auditWs = XLSX.utils.aoa_to_sheet(auditAoa);
    auditWs['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 32 },
      { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, auditWs, '数据审计报告');
  }

  const xlsBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([xlsBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportFile(file: CsvFile, options: ExportOptions): { blob: Blob; fileName: string; auditBlob?: Blob; auditFileName?: string } {
  const baseName = (options.fileName || file.name || 'export').replace(/\.(csv|xlsx)$/i, '');
  const ext = options.format === 'xlsx' ? '.xlsx' : '.csv';

  let auditReport: AuditReport | undefined;
  if (options.includeAuditReport) auditReport = buildAuditReport(file);

  let blob: Blob;
  let auditBlob: Blob | undefined;
  let auditFileName: string | undefined;

  if (options.format === 'xlsx') {
    blob = exportToExcel(file, options, auditReport);
  } else {
    blob = exportToCsv(file, options);
    if (auditReport) {
      auditBlob = exportAuditReportToCsv(auditReport, options.encoding || 'UTF-8', options.bom !== false);
      auditFileName = `${baseName}_审计报告.csv`;
    }
  }

  return { blob, fileName: `${baseName}${ext}`, auditBlob, auditFileName };
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
