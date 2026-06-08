import type { CsvFile, DataRow, DiffResult, ModifiedRow, ColumnInfo } from './types';
import { generateId, isNullish } from '../utils/detectType';

export type JoinMode = 'inner' | 'left' | 'right' | 'full';

export type ConflictStrategy =
  | 'keep_both'
  | 'keep_left'
  | 'keep_right'
  | 'right_coalesce';

export interface MergeTrackingOptions {
  addStatusColumn?: boolean;
  addLeftRowIndex?: boolean;
  addRightRowIndex?: boolean;
}

export interface MergeOptions extends MergeTrackingOptions {
  mode?: JoinMode;
  suffixes?: { left?: string; right?: string };
  conflictStrategy?: ConflictStrategy;
}

export interface KeyQualityIssue {
  type: 'left_duplicate' | 'right_duplicate' | 'left_null' | 'right_null' | 'one_to_many' | 'many_to_one';
  count: number;
  severity: 'warning' | 'error' | 'info';
  sampleRows: Array<{ key: string; rowIndex?: number; rowId?: string; values?: Record<string, string | number | null>; extra?: string }>;
  message: string;
}

export interface KeyQualityReport {
  leftRows: number;
  rightRows: number;
  leftUniqueKeys: number;
  rightUniqueKeys: number;
  keysExistInBoth: number;
  keysOnlyLeft: number;
  keysOnlyRight: number;
  issues: KeyQualityIssue[];
  hasCriticalIssue: boolean;
  overallRisk: 'low' | 'medium' | 'high';
}

export const SOURCE_TRACKING_COLUMNS = {
  status: '_匹配状态',
  leftRowIdx: '_左表原行号',
  rightRowIdx: '_右表原行号',
} as const;

const STATUS_LABEL: Record<string, string> = {
  unchanged: '双表匹配(不变)',
  modified: '双表匹配(修改)',
  'left-only': '仅在左表',
  'right-only': '仅在右表',
};

export interface BuildMergeResult {
  headers: string[];
  rows: Array<{
    values: Record<string, string | number | null>;
    status: DataRow['_flags']['diffStatus'];
    leftRowIndex?: number;
    rightRowIndex?: number;
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

export function keyQualityCheck(leftFile: CsvFile, rightFile: CsvFile, keys: string[]): KeyQualityReport {
  const buildKey = (row: DataRow): string =>
    keys.map((k) => (row.values[k] === null || row.values[k] === undefined ? '\u0000' : String(row.values[k]))).join('\u0001');

  const isNullKey = (row: DataRow): boolean =>
    keys.some((k) => isNullish(row.values[k]) || String(row.values[k]) === '');

  const leftRows = leftFile.rows;
  const rightRows = rightFile.rows;

  const leftNulls = leftRows.filter(isNullKey);
  const rightNulls = rightRows.filter(isNullKey);
  const leftNonNullRows = leftRows.filter((r) => !isNullKey(r));
  const rightNonNullRows = rightRows.filter((r) => !isNullKey(r));

  const leftKeyCounts = new Map<string, number>();
  const rightKeyCounts = new Map<string, number>();
  const leftKeyFirstIdx = new Map<string, DataRow>();
  const rightKeyFirstIdx = new Map<string, DataRow>();

  leftNonNullRows.forEach((r) => {
    const k = buildKey(r);
    leftKeyCounts.set(k, (leftKeyCounts.get(k) ?? 0) + 1);
    if (!leftKeyFirstIdx.has(k)) leftKeyFirstIdx.set(k, r);
  });
  rightNonNullRows.forEach((r) => {
    const k = buildKey(r);
    rightKeyCounts.set(k, (rightKeyCounts.get(k) ?? 0) + 1);
    if (!rightKeyFirstIdx.has(k)) rightKeyFirstIdx.set(k, r);
  });

  const leftDupKeys = Array.from(leftKeyCounts.entries()).filter(([, c]) => c > 1);
  const rightDupKeys = Array.from(rightKeyCounts.entries()).filter(([, c]) => c > 1);
  const leftUniqueKeys = leftKeyCounts.size;
  const rightUniqueKeys = rightKeyCounts.size;

  const commonKeys = Array.from(leftKeyCounts.keys()).filter((k) => rightKeyCounts.has(k));
  const onlyLeftKeys = Array.from(leftKeyCounts.keys()).filter((k) => !rightKeyCounts.has(k));
  const onlyRightKeys = Array.from(rightKeyCounts.keys()).filter((k) => !leftKeyCounts.has(k));

  const oneToMany: Array<{ key: string; count: number; sampleRow: DataRow | undefined }> = [];
  const manyToOne: typeof oneToMany = [];
  commonKeys.forEach((k) => {
    const lc = leftKeyCounts.get(k) ?? 0;
    const rc = rightKeyCounts.get(k) ?? 0;
    if (rc > 1 && lc === 1) oneToMany.push({ key: k, count: rc, sampleRow: leftKeyFirstIdx.get(k) });
    if (lc > 1 && rc === 1) manyToOne.push({ key: k, count: lc, sampleRow: leftKeyFirstIdx.get(k) });
  });

  const takeKeyVals = (row: DataRow | undefined): Record<string, any> => {
    const out: Record<string, any> = {};
    keys.forEach((k) => {
      out[k] = row ? row.values[k] : null;
    });
    return out;
  };

  const issues: KeyQualityIssue[] = [];

  if (leftNulls.length > 0) {
    issues.push({
      type: 'left_null',
      count: leftNulls.length,
      severity: leftNulls.length > leftRows.length * 0.05 ? 'error' : 'warning',
      message: `左表存在空关联键：${leftNulls.length} 行（占 ${(leftNulls.length / leftRows.length * 100).toFixed(1)}%），这些行无法参与匹配`,
      sampleRows: leftNulls.slice(0, 20).map((r) => ({
        key: '(空)',
        rowIndex: r._index,
        rowId: r._id,
        values: takeKeyVals(r),
      })),
    });
  }

  if (rightNulls.length > 0) {
    issues.push({
      type: 'right_null',
      count: rightNulls.length,
      severity: rightNulls.length > rightRows.length * 0.05 ? 'error' : 'warning',
      message: `右表存在空关联键：${rightNulls.length} 行（占 ${(rightNulls.length / rightRows.length * 100).toFixed(1)}%），这些行无法参与匹配`,
      sampleRows: rightNulls.slice(0, 20).map((r) => ({
        key: '(空)',
        rowIndex: r._index,
        rowId: r._id,
        values: takeKeyVals(r),
      })),
    });
  }

  if (leftDupKeys.length > 0) {
    const extraRows = leftDupKeys.reduce((s, [, c]) => s + c - 1, 0);
    issues.push({
      type: 'left_duplicate',
      count: extraRows,
      severity: 'warning',
      message: `左表有重复键：${leftDupKeys.length} 个键值重复，产生 ${extraRows} 条多余行`,
      sampleRows: leftDupKeys.slice(0, 20).map(([k, c]) => ({
        key: k,
        extra: `重复 ${c} 次`,
        rowIndex: leftKeyFirstIdx.get(k)?._index,
        values: takeKeyVals(leftKeyFirstIdx.get(k)),
      })),
    });
  }

  if (rightDupKeys.length > 0) {
    const extraRows = rightDupKeys.reduce((s, [, c]) => s + c - 1, 0);
    issues.push({
      type: 'right_duplicate',
      count: extraRows,
      severity: 'warning',
      message: `右表有重复键：${rightDupKeys.length} 个键值重复，产生 ${extraRows} 条多余行，可能导致合并结果行数膨胀`,
      sampleRows: rightDupKeys.slice(0, 20).map(([k, c]) => ({
        key: k,
        extra: `重复 ${c} 次`,
        rowIndex: rightKeyFirstIdx.get(k)?._index,
        values: takeKeyVals(rightKeyFirstIdx.get(k)),
      })),
    });
  }

  if (oneToMany.length > 0) {
    issues.push({
      type: 'one_to_many',
      count: oneToMany.length,
      severity: 'warning',
      message: `一对多匹配（左 1 行 → 右 N 行）：${oneToMany.length} 个键，可能输出行多于左表`,
      sampleRows: oneToMany.slice(0, 20).map(({ key, count, sampleRow }) => ({
        key,
        extra: `对应 ${count} 行`,
        rowIndex: sampleRow?._index,
        values: takeKeyVals(sampleRow),
      })),
    });
  }

  if (manyToOne.length > 0) {
    issues.push({
      type: 'many_to_one',
      count: manyToOne.length,
      severity: 'info',
      message: `多对一匹配（左 N 行 → 右 1 行）：${manyToOne.length} 个键`,
      sampleRows: manyToOne.slice(0, 20).map(({ key, count, sampleRow }) => ({
        key,
        extra: `左表 ${count} 行共用`,
        rowIndex: sampleRow?._index,
        values: takeKeyVals(sampleRow),
      })),
    });
  }

  const hasCriticalIssue = issues.some((i) => i.severity === 'error');
  const hasSeverityCount = issues.length;
  const overallRisk: KeyQualityReport['overallRisk'] = hasCriticalIssue
    ? 'high'
    : hasSeverityCount >= 3
    ? 'medium'
    : 'low';

  return {
    leftRows: leftRows.length,
    rightRows: rightRows.length,
    leftUniqueKeys,
    rightUniqueKeys,
    keysExistInBoth: commonKeys.length,
    keysOnlyLeft: onlyLeftKeys.length,
    keysOnlyRight: onlyRightKeys.length,
    issues,
    hasCriticalIssue,
    overallRisk,
  };
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
    suffixes = { left: '_左表', right: '_右表' },
    conflictStrategy = 'keep_both',
    addStatusColumn = false,
    addLeftRowIndex = false,
    addRightRowIndex = false,
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

  // 构建 tracking 列（可选，加到最前面）
  const trackingHeaders: string[] = [];
  if (addStatusColumn) trackingHeaders.push(SOURCE_TRACKING_COLUMNS.status);
  if (addLeftRowIndex) trackingHeaders.push(SOURCE_TRACKING_COLUMNS.leftRowIdx);
  if (addRightRowIndex) trackingHeaders.push(SOURCE_TRACKING_COLUMNS.rightRowIdx);

  // Bug 修复：keep_both 策略下，冲突列名不要出现在左表列里，只出现 列_左 + 列_右
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
    default: {
      // 关键修复：leftCols 里去掉冲突列，只保留非冲突列 + 冲突列_左 + 冲突列_右
      const leftNonConflictCols = leftCols.filter((c) => !conflictingCols.includes(c));
      newHeaders = [
        ...leftNonConflictCols,
        ...conflictingCols.map((c) => `${c}${suffixes.left ?? ''}`),
        ...conflictingCols.map((c) => `${c}${suffixes.right ?? ''}`),
        ...rightOnlyCols,
      ];
      break;
    }
  }
  newHeaders = [...trackingHeaders, ...newHeaders];

  const rows: BuildMergeResult['rows'] = [];
  const summary = {
    totalRows: 0,
    leftMatched: 0,
    rightMatched: 0,
    unmatchedLeft: 0,
    unmatchedRight: 0,
    bothMatched: 0,
  };

  const leftNonConflictCols = leftCols.filter((c) => !conflictingCols.includes(c));

  const applyConflictValues = (values: Record<string, string | number | null>, left?: DataRow, right?: DataRow) => {
    // Tracking 列先置空
    if (addStatusColumn) values[SOURCE_TRACKING_COLUMNS.status] = null;
    if (addLeftRowIndex) values[SOURCE_TRACKING_COLUMNS.leftRowIdx] = null;
    if (addRightRowIndex) values[SOURCE_TRACKING_COLUMNS.rightRowIdx] = null;

    newHeaders.forEach((h) => {
      if (trackingHeaders.includes(h)) return; // tracking 列已处理

      // 左表非冲突列（keep_both 下所有左列都走到这里，因为冲突列已被移除出 leftNonConflictCols）
      if (leftNonConflictCols.includes(h)) {
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
      // 冲突列（非 keep_both 下会出现原列名）
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

  const processRow = (
    left: DataRow | undefined,
    right: DataRow | undefined,
    status: DataRow['_flags']['diffStatus']
  ) => {
    const values: Record<string, string | number | null> = {};
    applyConflictValues(values, left, right);
    if (addStatusColumn) values[SOURCE_TRACKING_COLUMNS.status] = STATUS_LABEL[status] ?? status;
    if (addLeftRowIndex && left) values[SOURCE_TRACKING_COLUMNS.leftRowIdx] = left._index + 1;
    if (addRightRowIndex && right) values[SOURCE_TRACKING_COLUMNS.rightRowIdx] = right._index + 1;
    rows.push({
      values,
      status,
      leftRowIndex: left?._index,
      rightRowIndex: right?._index,
    });
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
      summary.unmatchedLeft++;
      // left-only 虽然未匹配到右表，但也算左表的行被计入（左表总行）
      // 对于统计对齐：在右连接时这些行会被跳过，不计入 leftMatched 结果内
    }
    if ((mode === 'inner' || mode === 'right') && !r) return;
    // 关键修复：对于左表行，只有在没有被跳过的时候才计入 leftMatched（right/inner 模式下 left-only 不计入 leftMatched 结果统计）
    if (!r) summary.leftMatched++;
    processRow(row, r, status);
  });

  // 2. 遍历右表，追加右表独有行
  if (mode === 'right' || mode === 'full') {
    const leftKeysSet = new Set(leftFile.rows.map(buildKey));
    rightFile.rows.forEach((row) => {
      const k = buildKey(row);
      if (!leftKeysSet.has(k)) {
        summary.unmatchedRight++;
        summary.rightMatched++;
        processRow(undefined, row, 'right-only');
      }
    });
  }

  // 关键修复：右连接/内连接下 unmatchedLeft 应该是 0（因为那些行根本没有出现在结果里）
  if (mode === 'right' || mode === 'inner') {
    summary.unmatchedLeft = 0;
  }
  // 左连接/内连接下 unmatchedRight 应该是 0（同理）
  if (mode === 'left' || mode === 'inner') {
    summary.unmatchedRight = 0;
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
  suffixes: { left?: string; right?: string } = { left: '_左表', right: '_右表' },
  conflictStrategy: ConflictStrategy = 'keep_both',
  tracking: MergeTrackingOptions = {}
): MergeResult {
  const buildResult = buildMerge(leftFile, rightFile, keys, {
    mode,
    suffixes,
    conflictStrategy,
    ...tracking,
  });
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
