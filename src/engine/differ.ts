import type { CsvFile, DataRow, DiffResult, ModifiedRow, ColumnInfo } from './types';
import { generateId, isNullish } from '../utils/detectType';

export type JoinMode = 'inner' | 'left' | 'right' | 'full';

export type ConflictStrategy =
  | 'keep_both'
  | 'keep_left'
  | 'keep_right'
  | 'right_coalesce';

export interface MergeOptions {
  mode?: JoinMode;
  suffixes?: { left?: string; right?: string };
  conflictStrategy?: ConflictStrategy;
}

export interface BuildMergeResult {
  headers: string[];
  rows: Array<{
    values: Record<string, string | number | null>;
    status: DataRow['_flags']['diffStatus'];
  }>;
  summary: {
    totalRows: number;
    leftMatched: number;
    rightMatched: number;
    unmatchedLeft: number;
    unmatchedRight: number;
    bothMatched: number;
  };
  conflictingCols: string[];
  leftCols: string[];
  rightOnlyCols: string[];
}

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

export function buildMerge(
  leftFile: CsvFile,
  rightFile: CsvFile,
  keys: string[],
  options: MergeOptions = {}
): BuildMergeResult {
  const {
    mode = 'left',
    suffixes = { left: '_左', right: '_右' },
    conflictStrategy = 'keep_both',
  } = options;

  const buildKey = (row: DataRow): string =>
    keys.map((k) => (row.values[k] === null || row.values[k] === undefined ? '\u0000' : String(row.values[k]))).join('\u0001');

  const leftMap = new Map<string, DataRow>();
  const rightMap = new Map<string, DataRow>();
  leftFile.rows.forEach((r) => leftMap.set(buildKey(r), r));
  rightFile.rows.forEach((r) => rightMap.set(buildKey(r), r));

  const diff = compareFiles(leftFile, rightFile, keys, mode);

  const leftCols = leftFile.headers;
  const rightOnlyCols = rightFile.headers.filter((c) => !keys.includes(c) && !leftCols.includes(c));
  const conflictingCols = rightFile.headers.filter((c) => !keys.includes(c) && leftCols.includes(c));

  let newHeaders: string[];
  switch (conflictStrategy) {
    case 'keep_left':
    case 'right_coalesce':
      newHeaders = [...leftCols, ...rightOnlyCols];
      break;
    case 'keep_right':
      newHeaders = [
        ...keys,
        ...leftCols.filter((c) => !keys.includes(c) && !conflictingCols.includes(c)),
        ...conflictingCols,
        ...rightOnlyCols,
      ];
      break;
    case 'keep_both':
    default:
      newHeaders = [
        ...leftCols,
        ...conflictingCols.map((c) => `${c}${suffixes.left ?? ''}`),
        ...conflictingCols.map((c) => `${c}${suffixes.right ?? ''}`),
        ...rightOnlyCols,
      ];
      break;
  }

  const rows: BuildMergeResult['rows'] = [];
  const summary = {
    totalRows: 0,
    leftMatched: 0,
    rightMatched: 0,
    unmatchedLeft: 0,
    unmatchedRight: 0,
    bothMatched: 0,
  };

  const applyConflictValues = (values: Record<string, string | number | null>, left?: DataRow, right?: DataRow) => {
    newHeaders.forEach((h) => {
      // 左表非冲突列
      if (leftCols.includes(h) && !conflictingCols.includes(h)) {
        values[h] = left ? left.values[h] ?? null : null;
        return;
      }
      // 右表独有列
      if (rightOnlyCols.includes(h)) {
        values[h] = right ? right.values[h] ?? null : null;
        return;
      }
      // 主键列
      if (keys.includes(h)) {
        const src = left ?? right;
        values[h] = src ? src.values[h] ?? null : null;
        return;
      }
      // 冲突列 - 4种策略
      if (conflictingCols.includes(h)) {
        const lv = left ? left.values[h] ?? null : null;
        const rv = right ? right.values[h] ?? null : null;
        switch (conflictStrategy) {
          case 'keep_left':
            values[h] = lv;
            break;
          case 'keep_right':
            values[h] = rv;
            break;
          case 'right_coalesce':
            values[h] = isNullish(rv) ? lv : rv;
            break;
          case 'keep_both':
          default:
            // 不会到这里，因为 keep_both 会加后缀
            values[h] = lv;
            break;
        }
        return;
      }
      // keep_both 下的左后缀冲突列
      const leftSuffixBase = conflictingCols.find((c) => h === `${c}${suffixes.left ?? ''}`);
      if (leftSuffixBase) {
        values[h] = left ? left.values[leftSuffixBase] ?? null : null;
        return;
      }
      // keep_both 下的右后缀冲突列
      const rightSuffixBase = conflictingCols.find((c) => h === `${c}${suffixes.right ?? ''}`);
      if (rightSuffixBase) {
        values[h] = right ? right.values[rightSuffixBase] ?? null : null;
        return;
      }
      if (!(h in values)) values[h] = null;
    });
  };

  const processRow = (left: DataRow | undefined, right: DataRow | undefined, status: DataRow['_flags']['diffStatus']) => {
    const values: Record<string, string | number | null> = {};
    applyConflictValues(values, left, right);
    rows.push({ values, status });
  };

  // 1. 遍历左表
  leftFile.rows.forEach((row) => {
    const k = buildKey(row);
    const r = rightMap.get(k);
    let status: DataRow['_flags']['diffStatus'] = 'unchanged';
    if (r) {
      status = diff.modified.some((m) => m.key === k) ? 'modified' : 'unchanged';
      summary.bothMatched++;
      summary.leftMatched++;
      summary.rightMatched++;
    } else {
      status = 'left-only';
      summary.leftMatched++;
      summary.unmatchedLeft++;
    }
    // 右连接 / 内连接：无匹配右表行则跳过
    if ((mode === 'inner' || mode === 'right') && !r) return;
    processRow(row, r, status);
  });

  // 2. 遍历右表，追加右表独有行
  if (mode === 'right' || mode === 'full') {
    const leftKeysSet = new Set(leftFile.rows.map(buildKey));
    rightFile.rows.forEach((row) => {
      const k = buildKey(row);
      if (!leftKeysSet.has(k)) {
        summary.rightMatched++;
        summary.unmatchedRight++;
        processRow(undefined, row, 'right-only');
      }
    });
  }

  summary.totalRows = rows.length;
  return { headers: newHeaders, rows, summary, conflictingCols, leftCols, rightOnlyCols };
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
  suffixes: { left?: string; right?: string } = { left: '_左', right: '_右' },
  conflictStrategy: ConflictStrategy = 'keep_both'
): MergeResult {
  const buildResult = buildMerge(leftFile, rightFile, keys, { mode, suffixes, conflictStrategy });
  const diff = compareFiles(leftFile, rightFile, keys, mode);

  const mergedRows: DataRow[] = buildResult.rows.map((r, idx) => ({
    _id: generateId(),
    _index: idx,
    _flags: { diffStatus: r.status },
    values: r.values,
  }));

  const columns: ColumnInfo[] = buildResult.headers.map((name, index) => {
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
    headers: buildResult.headers,
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
