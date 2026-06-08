import type { CsvFile, DataRow, DiffResult, ModifiedRow } from './types';
import { generateId, isNullish } from '../utils/detectType';

export type JoinMode = 'inner' | 'left' | 'right' | 'full';

export function compareFiles(leftFile: CsvFile, rightFile: CsvFile, keys: string[], mode: JoinMode = 'full'): DiffResult {
  const keyColumn = keys.join(' + ');

  const buildKey = (row: DataRow): string =>
    keys.map((k) => (row.values[k] === null || row.values[k] === undefined ? '\u0000' : String(row.values[k]))).join('\u0001');

  const leftMap = new Map<string, DataRow>();
  const rightMap = new Map<string, DataRow>();

  leftFile.rows.forEach((r) => leftMap.set(buildKey(r), r));
  rightFile.rows.forEach((r) => rightMap.set(buildKey(r), r));

  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);

  const added: DataRow[] = [];
  const removed: DataRow[] = [];
  const modified: ModifiedRow[] = [];
  const unchanged: string[] = [];

  const allCols = Array.from(new Set([...leftFile.headers, ...rightFile.headers]));

  const includeLeftOnly = mode === 'left' || mode === 'full';
  const includeRightOnly = mode === 'right' || mode === 'full';

  allKeys.forEach((key) => {
    const l = leftMap.get(key);
    const r = rightMap.get(key);

    if (l && !r) {
      if (includeLeftOnly) {
        removed.push({
          ...l,
          _id: generateId(),
          _flags: { ...l._flags, diffStatus: 'left-only' },
        });
      }
    } else if (!l && r) {
      if (includeRightOnly) {
        added.push({
          ...r,
          _id: generateId(),
          _flags: { ...r._flags, diffStatus: 'right-only' },
        });
      }
    } else if (l && r) {
      const changedCols: string[] = [];
      allCols.forEach((col) => {
        const lv = l.values[col];
        const rv = r.values[col];
        const ln = isNullish(lv);
        const rn = isNullish(rv);
        if (ln && rn) return;
        if (ln !== rn) {
          changedCols.push(col);
          return;
        }
        if (String(lv) !== String(rv)) changedCols.push(col);
      });
      if (changedCols.length > 0) {
        modified.push({
          key,
          left: l,
          right: r,
          changedColumns: changedCols,
        });
      } else {
        unchanged.push(key);
      }
    }
  });

  return {
    keyColumn,
    added,
    removed,
    modified,
    unchanged,
    stats: {
      leftOnly: removed.length,
      rightOnly: added.length,
      bothChanged: modified.length,
      bothSame: unchanged.length,
      totalDiff: removed.length + added.length + modified.length,
    },
  };
}

export interface MergeResult {
  file: CsvFile;
  diff: DiffResult;
}

export function mergeFiles(
  leftFile: CsvFile,
  rightFile: CsvFile,
  keys: string[],
  mode: JoinMode = 'left',
  suffixes: { left?: string; right?: string } = { left: '_左', right: '_右' }
): MergeResult {
  const diff = compareFiles(leftFile, rightFile, keys, mode);

  const buildKey = (row: DataRow): string =>
    keys.map((k) => (row.values[k] === null || row.values[k] === undefined ? '\u0000' : String(row.values[k]))).join('\u0001');

  const rightMap = new Map<string, DataRow>();
  rightFile.rows.forEach((r) => rightMap.set(buildKey(r), r));

  const leftCols = leftFile.headers;
  const rightCols = rightFile.headers.filter((c) => !keys.includes(c) && !leftCols.includes(c));
  const conflictingCols = rightFile.headers.filter((c) => !keys.includes(c) && leftCols.includes(c));

  const newHeaders = [
    ...leftCols,
    ...conflictingCols.map((c) => `${c}${suffixes.left ?? ''}`),
    ...conflictingCols.map((c) => `${c}${suffixes.right ?? ''}`),
    ...rightCols,
  ];

  const mergedRows: DataRow[] = [];
  let rowIdx = 0;

  const processRow = (left: DataRow | undefined, right: DataRow | undefined, status: DataRow['_flags']['diffStatus']) => {
    const values: Record<string, string | number | null> = {};
    newHeaders.forEach((h) => {
      if (left && leftCols.includes(h)) values[h] = left.values[h] ?? null;
      else if (right && rightCols.includes(h)) values[h] = right.values[h] ?? null;
      else if (left) {
        const base = conflictingCols.find((c) => h === `${c}${suffixes.left ?? ''}`);
        if (base) values[h] = left.values[base] ?? null;
      }
      if (right) {
        const base = conflictingCols.find((c) => h === `${c}${suffixes.right ?? ''}`);
        if (base) values[h] = right.values[base] ?? null;
      }
      if (!(h in values)) values[h] = null;
    });
    mergedRows.push({
      _id: generateId(),
      _index: rowIdx++,
      _flags: { diffStatus: status },
      values,
    });
  };

  const leftKeysSet = new Set<string>();
  leftFile.rows.forEach((row) => {
    const k = buildKey(row);
    leftKeysSet.add(k);
    const r = rightMap.get(k);
    let status: DataRow['_flags']['diffStatus'] = 'unchanged';
    if (r) {
      status = diff.modified.some((m) => m.key === k) ? 'modified' : 'unchanged';
    } else {
      status = 'left-only';
    }
    if (mode === 'inner' && !r) return;
    processRow(row, r, status);
  });

  if (mode === 'right' || mode === 'full') {
    rightFile.rows.forEach((row) => {
      const k = buildKey(row);
      if (!leftKeysSet.has(k)) {
        processRow(undefined, row, 'right-only');
      }
    });
  }

  const columns = newHeaders.map((name, index) => {
    const colValues = mergedRows.map((r) => r.values[name] ?? null);
    const nonNull = colValues.filter((v) => v !== null) as (string | number)[];
    return {
      name,
      index,
      type: 'mixed' as const,
      inferred: false,
      nullCount: colValues.length - nonNull.length,
      uniqueCount: new Set(nonNull.map((v) => String(v))).size,
      sampleValues: colValues.slice(0, 10),
    };
  });

  const mergedFile: CsvFile = {
    id: generateId(),
    name: `合并_${leftFile.name}_${rightFile.name}`,
    size: leftFile.size + rightFile.size,
    encoding: leftFile.encoding,
    delimiter: leftFile.delimiter,
    headers: newHeaders,
    columns,
    rows: mergedRows,
    rowCount: mergedRows.length,
    importedAt: Date.now(),
    meta: {
      nullCount: 0,
      duplicateCount: 0,
      samples: mergedRows.slice(0, 5),
    },
  };

  return { file: mergedFile, diff };
}
