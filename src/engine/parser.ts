import Papa from 'papaparse';
import jschardet from 'jschardet';
import type { CsvFile, ColumnInfo, DataRow } from './types';
import { detectColumnType, generateId, isNullish } from '../utils/detectType';

export interface ParseOptions {
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
}

export function detectEncoding(buffer: ArrayBuffer): string {
  try {
    const uint8 = new Uint8Array(buffer);
    let sampleSize = Math.min(uint8.length, 65536);
    let binary = '';
    for (let i = 0; i < sampleSize; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const result = jschardet.detect(binary);
    if (result && result.confidence > 0.6) {
      const enc = result.encoding.toLowerCase();
      if (enc === 'gb2312' || enc === 'gbk' || enc === 'gb18030') return 'GBK';
      if (enc === 'utf-8' || enc === 'utf8') return 'UTF-8';
      if (enc.includes('ascii')) return 'UTF-8';
      return result.encoding;
    }
  } catch {
    // ignore
  }
  return 'UTF-8';
}

export function decodeBuffer(buffer: ArrayBuffer, encoding: string): string {
  try {
    const decoder = new TextDecoder(encoding, { fatal: false });
    return decoder.decode(buffer);
  } catch {
    try {
      return new TextDecoder('UTF-8').decode(buffer);
    } catch {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return binary;
    }
  }
}

export interface ParseResult {
  file: CsvFile;
  rawText: string;
}

export function parseCsvText(
  text: string,
  fileName: string,
  fileSize: number,
  options: ParseOptions = {}
): ParseResult {
  const delimiter = options.delimiter || '';
  const hasHeader = options.hasHeader !== false;

  const result = Papa.parse<(string | number)[]>(text, {
    delimiter: delimiter || undefined,
    skipEmptyLines: 'greedy' as 'greedy',
    dynamicTyping: false,
  });

  const detectedDelimiter = (result.meta.delimiter as string) || ',';
  const rows = result.data.filter((r) => r && r.length > 0 && r.some((c) => String(c).trim() !== ''));

  if (rows.length === 0) {
    const emptyFile: CsvFile = {
      id: generateId(),
      name: fileName,
      size: fileSize,
      encoding: options.encoding || 'UTF-8',
      delimiter: detectedDelimiter,
      headers: [],
      columns: [],
      rows: [],
      rowCount: 0,
      importedAt: Date.now(),
      meta: { nullCount: 0, duplicateCount: 0, samples: [] },
      originalRaw: text,
    };
    return { file: emptyFile, rawText: text };
  }

  let headers: string[];
  let dataStart = 0;

  if (hasHeader) {
    headers = rows[0].map((h, i) => (h !== null && h !== undefined && String(h).trim() !== '' ? String(h).trim() : `列${i + 1}`));
    dataStart = 1;
  } else {
    const colCount = rows[0].length;
    headers = Array.from({ length: colCount }, (_, i) => `列${i + 1}`);
  }

  headers = headers.map((h, idx) => {
    const count = headers.slice(0, idx).filter((x) => x === h).length;
    return count > 0 ? `${h}_${count + 1}` : h;
  });

  const dataRows = rows.slice(dataStart);

  const columns: ColumnInfo[] = headers.map((name, colIndex) => {
    const colValues: (string | number | null)[] = dataRows.map((row) => {
      const v = row[colIndex];
      return isNullish(v) ? null : typeof v === 'number' ? v : String(v);
    });
    const nullCount = colValues.filter((v) => v === null).length;
    const nonNull = colValues.filter((v) => v !== null) as (string | number)[];
    const uniqueSet = new Set(nonNull.map((v) => String(v)));
    const sampleValues = colValues.slice(0, 10);

    return {
      name,
      index: colIndex,
      type: detectColumnType(colValues),
      inferred: true,
      nullCount,
      uniqueCount: uniqueSet.size,
      sampleValues,
    };
  });

  let nullTotal = 0;
  let duplicateCount = 0;
  const seenKeys = new Map<string, number>();

  const parsedRows: DataRow[] = dataRows.map((row, rowIdx) => {
    const values: Record<string, string | number | null> = {};
    let hasNull = false;
    const rowKeyParts: string[] = [];

    headers.forEach((h, i) => {
      const raw = row[i];
      const v = isNullish(raw) ? null : typeof raw === 'number' ? raw : String(raw);
      values[h] = v;
      if (v === null) hasNull = true;
      rowKeyParts.push(v === null ? '\u0000' : String(v));
    });

    if (hasNull) nullTotal++;

    const rowKey = rowKeyParts.join('\u0001');
    const prev = seenKeys.get(rowKey);
    const isDup = prev !== undefined;
    if (isDup) duplicateCount++;
    seenKeys.set(rowKey, rowIdx);

    return {
      _id: generateId(),
      _index: rowIdx,
      _flags: {
        isNull: hasNull,
        isDuplicate: isDup,
        modified: false,
      },
      values,
    };
  });

  const file: CsvFile = {
    id: generateId(),
    name: fileName,
    size: fileSize,
    encoding: options.encoding || 'UTF-8',
    delimiter: detectedDelimiter,
    headers,
    columns,
    rows: parsedRows,
    rowCount: parsedRows.length,
    importedAt: Date.now(),
    meta: {
      nullCount: nullTotal,
      duplicateCount,
      samples: parsedRows.slice(0, 5),
    },
    originalRaw: text,
  };

  return { file, rawText: text };
}

export async function parseFile(file: File, options: ParseOptions = {}): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const encoding = options.encoding || detectEncoding(buffer);
  const text = decodeBuffer(buffer, encoding);
  return parseCsvText(text, file.name, file.size, { ...options, encoding });
}
