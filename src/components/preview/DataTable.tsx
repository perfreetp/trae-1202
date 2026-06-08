import React, { useMemo, useState } from 'react';
import type { ColumnInfo, DataRow } from '../../engine/types';
import { useFileStore } from '../../store/useFileStore';
import { formatNumber } from '../../utils/detectType';
import { cn } from '../../lib/utils';
import { Badge } from '../common/Badge';
import { Input } from '../common/Form';
import { Search, ChevronUp, ChevronDown, FilterX, AlertTriangle, Hash, Calendar, ToggleLeft, FileText, Shuffle } from 'lucide-react';

type LucideIcon = React.ComponentType<any>;
const typeIcons: Record<string, LucideIcon> = {
  number: Hash,
  date: Calendar,
  boolean: ToggleLeft,
  string: FileText,
  mixed: Shuffle,
};

type DiffStatusFilter = 'all' | 'unchanged' | 'modified' | 'left-only' | 'right-only';

const DIFF_STATUS_OPTIONS: Array<{ value: DiffStatusFilter; label: string; variant: any; badgeCls: string }> = [
  { value: 'all', label: '全部', variant: 'default', badgeCls: 'bg-slate-50 text-slate-700 hover:bg-slate-200' },
  { value: 'unchanged', label: '双表匹配(不变)', variant: 'success', badgeCls: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-200' },
  { value: 'modified', label: '双表匹配(修改)', variant: 'warning', badgeCls: 'bg-amber-50 text-amber-800 hover:bg-amber-200' },
  { value: 'left-only', label: '仅在左表', variant: 'danger', badgeCls: 'bg-rose-50 text-rose-800 hover:bg-rose-200' },
  { value: 'right-only', label: '仅在右表', variant: 'info', badgeCls: 'bg-sky-50 text-sky-800 hover:bg-sky-200' },
];

export const ColumnTypeBadge: React.FC<{ column: ColumnInfo }> = ({ column }) => {
  const Icon = typeIcons[column.type] || FileText;
  const typeLabels: Record<string, string> = {
    number: '数字',
    date: '日期',
    boolean: '布尔',
    string: '文本',
    mixed: '混合',
  };
  return (
    <Badge variant={column.type as any} dot size="sm">
      <Icon size={10} className={cn('opacity-70', column.inferred && 'opacity-100')} />
      {typeLabels[column.type]}
      {column.inferred && <span className="opacity-50 ml-0.5">推断</span>}
    </Badge>
  );
};

export const StatsPanel: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile());
  if (!f) return null;
  const totalCells = f.rowCount * f.headers.length;
  const filledCells = f.rows.reduce(
    (sum, r) => sum + Object.values(r.values).filter((v) => v !== null && v !== '' && v !== undefined).length,
    0
  );
  const completion = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const uniqueRows = f.rowCount - f.meta.duplicateCount;

  const stats = [
    {
      label: '数据行数',
      value: formatNumber(f.rowCount),
      sub: `${formatNumber(f.headers.length)} 列`,
      color: 'from-sky-500 to-sky-600',
      icon: '📊',
    },
    {
      label: '完整率',
      value: `${completion}%`,
      sub: `${formatNumber(filledCells)} / ${formatNumber(totalCells)} 单元格`,
      color: 'from-emerald-500 to-emerald-600',
      icon: '✅',
    },
    {
      label: '空值/重复',
      value: `${formatNumber(f.meta.nullCount)} / ${formatNumber(f.meta.duplicateCount)}`,
      sub: '需清洗的行数',
      color: 'from-amber-500 to-amber-600',
      icon: '⚠️',
    },
    {
      label: '唯一记录',
      value: formatNumber(uniqueRows),
      sub: `去重后 ${Math.round((uniqueRows / Math.max(f.rowCount, 1)) * 100)}%`,
      color: 'from-violet-500 to-violet-600',
      icon: '🔑',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="relative rounded-xl border border-slate-200 bg-white p-4 overflow-hidden">
          <div className={cn('absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br opacity-10', s.color)} />
          <div className="relative">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">{s.value}</div>
            <div className="mt-1 text-[11px] text-slate-400">{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface SortState {
  column: string | null;
  dir: 'asc' | 'desc' | null;
}

export const DataTable: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile());
  const { toggleSelectRow, selectedRowIds, selectedColumn, setSelectedColumn } = useFileStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sampleSize, setSampleSize] = useState<50 | 100 | 500 | 'all'>(100);
  const [sort, setSort] = useState<SortState>({ column: null, dir: null });
  const [activeDiffStatus, setActiveDiffStatus] = useState<DiffStatusFilter>('all');

  const PAGE_SIZE = 50;

  const hasDiffColumn = useMemo(() => {
    if (!f) return false;
    if (f.headers.some((h) => h === '_匹配状态')) return true;
    return f.rows.some((r) => !!r._flags?.diffStatus);
  }, [f]);

  const filteredRows = useMemo(() => {
    if (!f) return [];
    let rows = f.rows;
    if (activeDiffStatus !== 'all') {
      rows = rows.filter((r) => r._flags?.diffStatus === activeDiffStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r.values).some((v) => v !== null && String(v).toLowerCase().includes(q))
      );
    }
    if (sort.column && sort.dir) {
      const col = sort.column;
      const colInfo = f.columns.find((c) => c.name === col);
      const isNum = colInfo?.type === 'number';
      rows = [...rows].sort((a, b) => {
        const av = a.values[col];
        const bv = b.values[col];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        let cmp: number;
        if (isNum) cmp = Number(av) - Number(bv);
        else cmp = String(av).localeCompare(String(bv));
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    if (sampleSize !== 'all') rows = rows.slice(0, sampleSize);
    return rows;
  }, [f, activeDiffStatus, search, sort, sampleSize]);

  if (!f) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <div className="text-slate-400 text-sm">请先导入文件或选择左侧一个文件进行预览</div>
      </div>
    );
  }

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const displayRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (col: string) => {
    setSort((prev) => {
      if (prev.column !== col) return { column: col, dir: 'asc' };
      if (prev.dir === 'asc') return { column: col, dir: 'desc' };
      if (prev.dir === 'desc') return { column: null, dir: null };
      return { column: col, dir: 'asc' };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="搜索全部列..."
            value={search}
            onChange={setSearch}
            className="w-64"
            leftIcon={<Search size={14} />}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1">
              <FilterX size={12} /> 清除
            </button>
          )}
          <select
            value={String(sampleSize)}
            onChange={(e) => {
              setSampleSize(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 50 | 100 | 500));
              setPage(0);
            }}
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="50">抽样前 50 行</option>
            <option value="100">抽样前 100 行</option>
            <option value="500">抽样前 500 行</option>
            <option value="all">显示全部</option>
          </select>
        </div>
        <div className="text-xs text-slate-500">
          显示 {formatNumber(displayRows.length)} / {formatNumber(filteredRows.length)} 行
          {search && ` (搜索结果)`}
          {activeDiffStatus !== 'all' && ` (来源筛选)`}
        </div>
      </div>

      {hasDiffColumn && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">来源状态：</span>
          {DIFF_STATUS_OPTIONS.map((opt) => {
            const active = activeDiffStatus === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setActiveDiffStatus(opt.value);
                  setPage(0);
                }}
                className={cn(
                  'px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-all',
                  active
                    ? `${opt.badgeCls} border-current shadow-sm`
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full border-collapse text-sm" style={{ minWidth: Math.max(f.headers.length * 120, 800) }}>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-2 py-2.5 text-left border-r border-slate-200 text-slate-400 font-medium text-xs sticky left-0 bg-slate-50 z-20">
                  #
                </th>
                {f.headers.map((h, i) => {
                  const col = f.columns[i];
                  const sorted = sort.column === h;
                  const isSel = selectedColumn === h;
                  return (
                    <th
                      key={h}
                      onClick={() => handleSort(h)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedColumn(isSel ? null : h);
                      }}
                      className={cn(
                        'px-3 py-2.5 text-left font-medium border-r border-slate-200 whitespace-nowrap cursor-pointer select-none group transition-colors',
                        sorted ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-100',
                        isSel && 'bg-amber-50 ring-1 ring-amber-200'
                      )}
                      title="点击排序 / 右键选择整列"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[180px]">{h}</span>
                        {sorted && sort.dir && (sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                      {col && (
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          <ColumnTypeBadge column={col} />
                          {col.nullCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                              <AlertTriangle size={8} />
                              {formatNumber(col.nullCount)}空
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={f.headers.length + 1} className="px-4 py-16 text-center text-sm text-slate-400">
                    没有符合条件的数据行
                  </td>
                </tr>
              )}
              {displayRows.map((row, i) => (
                <RowView
                  key={row._id}
                  row={row}
                  globalIndex={page * PAGE_SIZE + i}
                  headers={f.headers}
                  selected={selectedRowIds.has(row._id)}
                  onToggle={() => toggleSelectRow(row._id)}
                  selectedColumn={selectedColumn}
                />
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
            <span>
              第 {page + 1} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-white"
              >
                首页
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-white"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-white"
              >
                下一页
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-white"
              >
                末页
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
        <span>💡 提示：点击列名排序；右键列名选中整列；点击 # 列的复选框选择行</span>
      </div>
    </div>
  );
};

const RowView: React.FC<{
  row: DataRow;
  globalIndex: number;
  headers: string[];
  selected: boolean;
  onToggle: () => void;
  selectedColumn: string | null;
}> = ({ row, globalIndex, headers, selected, onToggle, selectedColumn }) => {
  const hasIssue = row._flags.isNull || row._flags.isDuplicate;
  const status = row._flags.diffStatus;
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-teal-50/30 group',
        selected && 'bg-amber-50 hover:bg-amber-50',
        status === 'left-only' && 'bg-rose-50/60 hover:bg-rose-50',
        status === 'right-only' && 'bg-emerald-50/60 hover:bg-emerald-50',
        status === 'modified' && 'bg-amber-50/60 hover:bg-amber-50'
      )}
    >
      <td
        className={cn(
          'px-2 py-2 text-xs border-r border-slate-100 sticky left-0 z-10 whitespace-nowrap',
          'bg-inherit',
          selected ? 'bg-amber-50' : 'bg-white group-hover:bg-teal-50/30'
        )}
      >
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
          />
          <span
            className={cn(
              'tabular-nums',
              hasIssue ? 'text-amber-600 font-semibold' : 'text-slate-400',
              status === 'left-only' && 'text-rose-600',
              status === 'right-only' && 'text-emerald-600',
              status === 'modified' && 'text-amber-700'
            )}
          >
            {row._index + 1}
          </span>
          {row._flags.isDuplicate && (
            <span title="重复行" className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          )}
          {row._flags.isNull && !row._flags.isDuplicate && (
            <span title="含空值" className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
        </div>
      </td>
      {headers.map((h) => {
        const v = row.values[h];
        const isNull = v === null || v === undefined || v === '';
        const isColSel = selectedColumn === h;
        const changed = row._flags.changedColumns?.includes(h);
        return (
          <td
            key={h}
            className={cn(
              'px-3 py-2 border-r border-slate-100 text-slate-800 align-middle',
              'whitespace-nowrap max-w-[300px] truncate',
              isNull && 'text-slate-400 italic',
              isColSel && 'bg-amber-50/80',
              changed && 'bg-amber-100/80 text-amber-900'
            )}
            title={v === null ? '（空值）' : String(v)}
          >
            {isNull ? <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">空</span> : typeof v === 'number' ? (
              <span className="font-mono tabular-nums text-violet-700">{formatNumber(v)}</span>
            ) : (
              String(v)
            )}
          </td>
        );
      })}
    </tr>
  );
};
