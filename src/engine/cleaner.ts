import type { CsvFile, DataRow, FilterCondition, ColumnInfo } from './types';
import { produce } from 'immer';
import { escapeRegExp, generateId, isNullish } from '../utils/detectType';
import { detectColumnType } from '../utils/detectType';

export function recalcMeta(file: CsvFile): CsvFile {
  return produce(file, (draft) => {
    let nullCount = 0;
    const seen = new Map<string, number>();
    let duplicateCount = 0;

    draft.rows.forEach((row, idx) => {
      let hasNull = false;
      const parts: string[] = [];
      Object.values(row.values).forEach((v) => {
        if (v === null) hasNull = true;
        parts.push(v === null ? '\u0000' : String(v));
      });
      if (hasNull) nullCount++;
      const key = parts.join('\u0001');
      const prev = seen.get(key);
      const dup = prev !== undefined;
      if (dup) duplicateCount++;
      seen.set(key, idx);
      row._flags.isNull = hasNull;
      row._flags.isDuplicate = dup;
    });

    draft.meta.nullCount = nullCount;
    draft.meta.duplicateCount = duplicateCount;
    draft.meta.samples = draft.rows.slice(0, 5);
    draft.rowCount = draft.rows.length;

    draft.headers.forEach((h, i) => {
      const col = draft.columns[i];
      if (!col) return;
      const colValues = draft.rows.map((r) => r.values[h] ?? null);
      const nonNull = colValues.filter((v) => v !== null) as (string | number)[];
      col.nullCount = colValues.length - nonNull.length;
      col.uniqueCount = new Set(nonNull.map((v) => String(v))).size;
      col.sampleValues = colValues.slice(0, 10);
      col.type = detectColumnType(colValues);
    });
  });
}

export function markNulls(file: CsvFile, columns: string[], marker: string): CsvFile {
  const targets = columns.length > 0 ? columns : file.headers;
  return produce(file, (draft) => {
    draft.rows.forEach((row) => {
      targets.forEach((col) => {
        const v = row.values[col];
        if (isNullish(v)) {
          row.values[col] = marker;
          row._flags.modified = true;
        }
      });
    });
  });
}

export function removeNulls(file: CsvFile, columns: string[], mode: 'any' | 'all'): CsvFile {
  const targets = columns.length > 0 ? columns : file.headers;
  return produce(file, (draft) => {
    const filtered: DataRow[] = [];
    draft.rows.forEach((row) => {
      const nulls = targets.filter((col) => isNullish(row.values[col])).length;
      const remove = mode === 'any' ? nulls > 0 : nulls === targets.length;
      if (!remove) filtered.push(row);
    });
    draft.rows = filtered;
  });
}

export function removeDuplicates(file: CsvFile, columns: string[], keepFirst = true): CsvFile {
  const targets = columns.length > 0 ? columns : file.headers;
  return produce(file, (draft) => {
    const seen = new Set<string>();
    const result: DataRow[] = [];
    const iter = keepFirst ? draft.rows : draft.rows.slice().reverse();
    iter.forEach((row) => {
      const key = targets.map((c) => (row.values[c] === null ? '\u0000' : String(row.values[c]))).join('\u0001');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(row);
      }
    });
    draft.rows = keepFirst ? result : result.reverse();
  });
}

export function bulkReplace(
  file: CsvFile,
  column: string,
  find: string,
  replace: string,
  useRegex = false
): CsvFile {
  const targets = column === '__ALL__' ? file.headers : [column];
  return produce(file, (draft) => {
    let regex: RegExp;
    if (useRegex) {
      try {
        regex = new RegExp(find, 'g');
      } catch {
        regex = new RegExp(escapeRegExp(find), 'g');
      }
    } else {
      regex = new RegExp(escapeRegExp(find), 'g');
    }
    draft.rows.forEach((row) => {
      targets.forEach((col) => {
        const v = row.values[col];
        if (typeof v === 'string') {
          const newV = v.replace(regex, replace);
          if (newV !== v) {
            row.values[col] = newV;
            row._flags.modified = true;
          }
        }
      });
    });
  });
}

export function filterRows(
  file: CsvFile,
  conditions: FilterCondition[],
  logic: 'AND' | 'OR' = 'AND'
): CsvFile {
  if (conditions.length === 0) return file;

  return produce(file, (draft) => {
    draft.rows.forEach((row) => {
      const results = conditions.map((cond) => matchCondition(row, cond));
      const pass = logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      row._flags.isFiltered = !pass;
    });
    draft.rows = draft.rows.filter((r) => !r._flags.isFiltered);
  });
}

function matchCondition(row: DataRow, cond: FilterCondition): boolean {
  const raw = row.values[cond.column];
  const v = raw === null ? '' : String(raw);
  const target = cond.value;

  switch (cond.operator) {
    case 'eq':
      return cond.caseSensitive ? v === target : v.toLowerCase() === target.toLowerCase();
    case 'ne':
      return cond.caseSensitive ? v !== target : v.toLowerCase() !== target.toLowerCase();
    case 'gt':
      return Number(v) > Number(target);
    case 'lt':
      return Number(v) < Number(target);
    case 'gte':
      return Number(v) >= Number(target);
    case 'lte':
      return Number(v) <= Number(target);
    case 'contains':
      return cond.caseSensitive ? v.includes(target) : v.toLowerCase().includes(target.toLowerCase());
    case 'startsWith':
      return cond.caseSensitive ? v.startsWith(target) : v.toLowerCase().startsWith(target.toLowerCase());
    case 'endsWith':
      return cond.caseSensitive ? v.endsWith(target) : v.toLowerCase().endsWith(target.toLowerCase());
    case 'isNull':
      return raw === null || raw === '' || raw === undefined;
    case 'isNotNull':
      return raw !== null && raw !== '' && raw !== undefined;
    case 'regex':
      try {
        const re = new RegExp(target, cond.caseSensitive ? '' : 'i');
        return re.test(v);
      } catch {
        return false;
      }
    default:
      return true;
  }
}

export function findDuplicateRows(file: CsvFile, columns: string[]): { groups: DataRow[][]; count: number } {
  const targets = columns.length > 0 ? columns : file.headers;
  const groupsMap = new Map<string, DataRow[]>();

  file.rows.forEach((row) => {
    const key = targets.map((c) => (row.values[c] === null ? '\u0000' : String(row.values[c]))).join('\u0001');
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(row);
  });

  const groups = Array.from(groupsMap.values()).filter((g) => g.length > 1);
  return { groups, count: groups.reduce((s, g) => s + g.length, 0) };
}

export function locateErrors(file: CsvFile, columns: string[]): { rowId: string; rowIndex: number; issues: string[] }[] {
  const targets = columns.length > 0 ? columns : file.headers;
  const colInfoMap = new Map(file.columns.map((c) => [c.name, c]));
  const errors: { rowId: string; rowIndex: number; issues: string[] }[] = [];

  file.rows.forEach((row) => {
    const issues: string[] = [];
    targets.forEach((col) => {
      const info = colInfoMap.get(col);
      const v = row.values[col];
      if (info && info.type !== 'string' && info.type !== 'mixed' && v !== null) {
        const strV = String(v);
        if (info.type === 'number' && isNaN(Number(strV))) {
          issues.push(`${col}: 期望数字，实际为 "${strV}"`);
        } else if (info.type === 'date' && isNaN(new Date(strV).getTime())) {
          issues.push(`${col}: 期望日期，实际为 "${strV}"`);
        } else if (info.type === 'boolean' && !/^(true|false|yes|no|是|否|1|0)$/i.test(strV)) {
          issues.push(`${col}: 期望布尔，实际为 "${strV}"`);
        }
      }
    });
    if (issues.length > 0) {
      errors.push({ rowId: row._id, rowIndex: row._index, issues });
    }
  });

  return errors;
}

export function cloneRowWithNewId(row: DataRow, newIndex: number): DataRow {
  return {
    _id: generateId(),
    _index: newIndex,
    _flags: { ...row._flags },
    values: { ...row.values },
  };
}

export function rebuildColumns(file: CsvFile, newHeaders: string[]): ColumnInfo[] {
  return newHeaders.map((name, index) => {
    const colValues = file.rows.map((r) => r.values[name] ?? null);
    return {
      name,
      index,
      type: detectColumnType(colValues),
      inferred: true,
      nullCount: colValues.filter((v) => v === null).length,
      uniqueCount: new Set(colValues.filter((v) => v !== null).map((v) => String(v))).size,
      sampleValues: colValues.slice(0, 10),
    };
  });
}
