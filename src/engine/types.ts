export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'mixed';

export interface ColumnInfo {
  name: string;
  index: number;
  type: ColumnType;
  inferred: boolean;
  nullCount: number;
  uniqueCount: number;
  sampleValues: (string | number | null)[];
}

export interface RowFlags {
  isNull?: boolean;
  isDuplicate?: boolean;
  isFiltered?: boolean;
  modified?: boolean;
  diffStatus?: 'added' | 'removed' | 'modified' | 'unchanged' | 'left-only' | 'right-only';
  changedColumns?: string[];
}

export interface DataRow {
  _id: string;
  _index: number;
  _flags: RowFlags;
  values: Record<string, string | number | null>;
}

export interface CsvFile {
  id: string;
  name: string;
  size: number;
  encoding: string;
  delimiter: string;
  headers: string[];
  columns: ColumnInfo[];
  rows: DataRow[];
  rowCount: number;
  importedAt: number;
  meta: {
    nullCount: number;
    duplicateCount: number;
    samples: DataRow[];
  };
  originalRaw?: string;
}

export interface FilterCondition {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'isNull' | 'isNotNull' | 'regex';
  value: string;
  caseSensitive?: boolean;
}

export type WorkflowStepType =
  | 'IMPORT'
  | 'MARK_NULL'
  | 'REMOVE_NULL'
  | 'REMOVE_DUPLICATES'
  | 'REPLACE'
  | 'FILTER'
  | 'SPLIT_COLUMN'
  | 'MERGE_COLUMNS'
  | 'FORMULA_COLUMN'
  | 'CONVERT_TYPE'
  | 'COMPARE'
  | 'EXPORT';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  payload: Record<string, unknown>;
  timestamp: number;
  label: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: number;
  usageCount: number;
}

export interface ModifiedRow {
  key: string;
  left: DataRow;
  right: DataRow;
  changedColumns: string[];
}

export interface DiffResult {
  keyColumn: string;
  added: DataRow[];
  removed: DataRow[];
  modified: ModifiedRow[];
  unchanged: string[];
  stats: {
    leftOnly: number;
    rightOnly: number;
    bothChanged: number;
    bothSame: number;
    totalDiff: number;
  };
}

export type ModuleId = 'files' | 'preview' | 'clean' | 'transform' | 'compare' | 'export' | 'history';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
