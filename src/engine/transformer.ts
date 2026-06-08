import type { CsvFile, DataRow, ColumnType } from './types';
import { produce } from 'immer';
import { Parser as FormulaParser } from 'expr-eval';
import { rebuildColumns, recalcMeta, cloneRowWithNewId } from './cleaner';
import { generateId, isNullish } from '../utils/detectType';

export function splitColumn(
  file: CsvFile,
  source: string,
  delimiter: string,
  targets: string[],
  keepOriginal = false
): CsvFile {
  return produce(file, (draft) => {
    const srcIdx = draft.headers.indexOf(source);
    if (srcIdx === -1) return;

    const insertPoint = keepOriginal ? srcIdx + 1 : srcIdx;

    targets.forEach((t, i) => {
      if (!draft.headers.includes(t)) {
        draft.headers.splice(insertPoint + i, 0, t);
      }
    });

    draft.rows.forEach((row) => {
      const v = row.values[source];
      const parts = v === null || v === undefined ? [] : String(v).split(delimiter);
      targets.forEach((t, i) => {
        row.values[t] = parts[i] !== undefined ? parts[i] : null;
      });
      row._flags.modified = true;
    });

    if (!keepOriginal) {
      draft.headers = draft.headers.filter((h) => h !== source);
      draft.rows.forEach((row) => {
        delete row.values[source];
      });
    }
  });
}

export function mergeColumns(
  file: CsvFile,
  sources: string[],
  target: string,
  separator: string,
  keepOriginal = false
): CsvFile {
  return produce(file, (draft) => {
    if (!draft.headers.includes(target)) {
      draft.headers.push(target);
    }

    draft.rows.forEach((row) => {
      const values = sources.map((s) => (row.values[s] === null ? '' : String(row.values[s])));
      row.values[target] = values.join(separator);
      row._flags.modified = true;
    });

    if (!keepOriginal) {
      const keep = new Set(draft.headers.filter((h) => !sources.includes(h)));
      if (!keep.has(target)) keep.add(target);
      draft.headers = draft.headers.filter((h) => keep.has(h));
      draft.rows.forEach((row) => {
        Object.keys(row.values).forEach((k) => {
          if (!keep.has(k)) delete row.values[k];
        });
      });
    }
  });
}

export function convertType(file: CsvFile, column: string, toType: ColumnType, format?: string): CsvFile {
  return produce(file, (draft) => {
    const col = draft.columns.find((c) => c.name === column);
    if (!col) return;
    col.type = toType;
    col.inferred = false;

    draft.rows.forEach((row) => {
      const raw = row.values[column];
      if (raw === null || raw === undefined || raw === '') return;

      let converted: string | number | null = null;
      const str = String(raw);

      switch (toType) {
        case 'number': {
          const n = Number(str.replace(/[,\s]/g, ''));
          converted = isNaN(n) ? null : n;
          break;
        }
        case 'boolean': {
          if (/^(true|yes|是|1)$/i.test(str)) converted = 'true';
          else if (/^(false|no|否|0)$/i.test(str)) converted = 'false';
          else converted = null;
          break;
        }
        case 'date': {
          const d = new Date(str);
          if (!isNaN(d.getTime())) {
            if (format) {
              const pad = (n: number) => String(n).padStart(2, '0');
              converted = format
                .replace('YYYY', String(d.getFullYear()))
                .replace('MM', pad(d.getMonth() + 1))
                .replace('DD', pad(d.getDate()))
                .replace('HH', pad(d.getHours()))
                .replace('mm', pad(d.getMinutes()))
                .replace('ss', pad(d.getSeconds()));
            } else {
              converted = d.toISOString().slice(0, 10);
            }
          } else {
            converted = null;
          }
          break;
        }
        case 'string':
        default:
          converted = str;
      }

      if (converted !== raw) {
        row.values[column] = converted;
        row._flags.modified = true;
      }
    });
  });
}

export interface FormulaError {
  rowIndex: number;
  message: string;
}

export function addFormulaColumn(
  file: CsvFile,
  target: string,
  expression: string
): { file: CsvFile; errors: FormulaError[] } {
  const errors: FormulaError[] = [];
  const safeHeaders = file.headers.map((h) => h.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_'));
  const headerMap = new Map(file.headers.map((h, i) => [h, safeHeaders[i]]));

  let processedExpr = expression;
  file.headers.forEach((h) => {
    const safe = headerMap.get(h)!;
    const re = new RegExp(`\\[${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
    processedExpr = processedExpr.replace(re, safe);
  });

  let expr: { evaluate: (scope: Record<string, number>) => unknown };
  try {
    const fp = new FormulaParser();
    expr = fp.parse(processedExpr);
  } catch (e) {
    return { file, errors: [{ rowIndex: -1, message: `公式解析错误: ${(e as Error).message}` }] };
  }

  const newFile = produce(file, (draft) => {
    if (!draft.headers.includes(target)) {
      draft.headers.push(target);
    }

    draft.rows.forEach((row, idx) => {
      const scope: Record<string, number> = {};
      file.headers.forEach((h) => {
        const safe = headerMap.get(h)!;
        const v = row.values[h];
        scope[safe] = v === null || v === undefined || v === '' ? NaN : Number(v);
      });
      try {
        const result = expr.evaluate(scope);
        if (typeof result === 'number' && !isNaN(result)) {
          row.values[target] = Number.isInteger(result) ? result : Number(result.toFixed(10));
        } else if (typeof result === 'boolean') {
          row.values[target] = result ? 'true' : 'false';
        } else {
          row.values[target] = null;
        }
      } catch (e) {
        row.values[target] = null;
        if (errors.length < 20) {
          errors.push({ rowIndex: idx, message: (e as Error).message });
        }
      }
      row._flags.modified = true;
    });
  });

  return { file: newFile, errors };
}

export function renameColumn(file: CsvFile, oldName: string, newName: string): CsvFile {
  if (oldName === newName || !file.headers.includes(oldName) || file.headers.includes(newName)) return file;
  return produce(file, (draft) => {
    const idx = draft.headers.indexOf(oldName);
    draft.headers[idx] = newName;
    draft.rows.forEach((row) => {
      row.values[newName] = row.values[oldName];
      delete row.values[oldName];
      row._flags.modified = true;
    });
    const col = draft.columns.find((c) => c.name === oldName);
    if (col) col.name = newName;
  });
}

export function deleteColumns(file: CsvFile, columns: string[]): CsvFile {
  if (columns.length === 0) return file;
  const removeSet = new Set(columns);
  return produce(file, (draft) => {
    draft.headers = draft.headers.filter((h) => !removeSet.has(h));
    draft.rows.forEach((row) => {
      Object.keys(row.values).forEach((k) => {
        if (removeSet.has(k)) delete row.values[k];
      });
      row._flags.modified = true;
    });
  });
}

export function reorderColumns(file: CsvFile, newOrder: string[]): CsvFile {
  if (new Set(newOrder).size !== new Set(file.headers).size) return file;
  return produce(file, (draft) => {
    draft.headers = newOrder;
  });
}

export function finalizeTransform(file: CsvFile): CsvFile {
  let f = produce(file, (draft) => {
    draft.columns = rebuildColumns(draft, draft.headers);
    draft.rows = draft.rows.map((r, i) => cloneRowWithNewId(r, i));
  });
  f = recalcMeta(f);
  return f;
}
