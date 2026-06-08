import React, { useState } from 'react';
import { Tabs } from '../common/Tabs';
import { Button } from '../common/Button';
import { Input, Select, Checkbox, Textarea } from '../common/Form';
import { Badge } from '../common/Badge';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import * as cleaner from '../../engine/cleaner';
import { findDuplicateRows, locateErrors } from '../../engine/cleaner';
import type { FilterCondition } from '../../engine/types';
import { formatNumber } from '../../utils/detectType';
import { cn } from '../../lib/utils';
import { Trash2, AlertCircle, Copy, Search, Wand2, Target, ScanEye, ListChecks, Crosshair } from 'lucide-react';

type TabId = 'null' | 'duplicate' | 'replace' | 'filter' | 'locate';

export const CleanPanel: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile());
  const { updateActiveFile } = useFileStore();
  const { showToast, openModal } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [tab, setTab] = useState<TabId>('null');

  if (!f) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-400 text-sm">
        请先导入或选择文件以进行数据清洗
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs
        size="md"
        items={[
          { id: 'null', label: '空值处理', icon: <AlertCircle size={14} />, badge: formatNumber(f.meta.nullCount) },
          { id: 'duplicate', label: '重复行', icon: <Copy size={14} />, badge: formatNumber(f.meta.duplicateCount) },
          { id: 'replace', label: '批量替换', icon: <Wand2 size={14} /> },
          { id: 'filter', label: '条件筛选', icon: <Search size={14} /> },
          { id: 'locate', label: '错误定位', icon: <Crosshair size={14} /> },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === 'null' && <NullHandler />}
      {tab === 'duplicate' && <DuplicateFinder />}
      {tab === 'replace' && <BulkReplace />}
      {tab === 'filter' && <FilterBuilder />}
      {tab === 'locate' && <ErrorLocator />}
    </div>
  );
};

const ColumnCheckList: React.FC<{
  headers: string[];
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ headers, value, onChange }) => {
  const all = value.length === headers.length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Checkbox
          checked={all}
          onChange={(c) => onChange(c ? [...headers] : [])}
          label={<span className="text-xs font-medium text-slate-700">全选 / 清空</span>}
        />
        <span className="text-[11px] text-slate-400">已选 {value.length}/{headers.length}</span>
      </div>
      <div className="max-h-40 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
        {headers.map((h) => (
          <Checkbox
            key={h}
            checked={value.includes(h)}
            onChange={(c) => onChange(c ? [...value, h] : value.filter((x) => x !== h))}
            label={<span className="text-xs">{h}</span>}
          />
        ))}
      </div>
    </div>
  );
};

const NullHandler: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [cols, setCols] = useState<string[]>([]);
  const [marker, setMarker] = useState('N/A');
  const [mode, setMode] = useState<'any' | 'all'>('any');

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <ColumnCheckList headers={f.headers} value={cols} onChange={setCols} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input label="填充标记文本" value={marker} onChange={setMarker} placeholder="例如：N/A / 未知 / -" />
        <Select
          label="删除模式（按行）"
          value={mode}
          onChange={(v) => setMode(v as 'any' | 'all')}
          options={[
            { label: '任一列为空即删除', value: 'any' },
            { label: '全部为空才删除', value: 'all' },
          ]}
        />
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const targetCols = cols.length > 0 ? cols : f.headers;
              updateActiveFile((file) => cleaner.markNulls(file, targetCols, marker), true);
              addStep({ type: 'MARK_NULL', payload: { columns: targetCols, marker }, label: `空值填充为 ${marker}` });
              showToast({ type: 'success', message: '已完成空值填充' });
            }}
            leftIcon={<Wand2 size={14} />}
          >
            空值填充
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const targetCols = cols.length > 0 ? cols : f.headers;
              const before = f.rowCount;
              updateActiveFile((file) => cleaner.removeNulls(file, targetCols, mode), true);
              addStep({ type: 'REMOVE_NULL', payload: { columns: targetCols, mode }, label: `删除含空值行 (${mode})` });
              const after = useFileStore.getState().getActiveFile()?.rowCount ?? 0;
              showToast({ type: 'info', message: `删除了 ${formatNumber(before - after)} 行空值数据` });
            }}
            leftIcon={<Trash2 size={14} />}
          >
            删除含空行
          </Button>
        </div>
      </div>
      <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
        💡 当前文件共 <b>{formatNumber(f.meta.nullCount)}</b> 行包含空值；不选列则对所有列生效。
      </div>
    </div>
  );
};

const DuplicateFinder: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile, selectedRowIds, setSelectedRows } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [cols, setCols] = useState<string[]>([]);
  const [keepFirst, setKeepFirst] = useState(true);
  const [groups, setGroups] = useState(() => findDuplicateRows(f, cols));

  React.useEffect(() => {
    setGroups(findDuplicateRows(f, cols));
  }, [f, cols]);

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <ColumnCheckList headers={f.headers} value={cols} onChange={setCols} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3">
          <div className="text-xs text-slate-500 mb-1">
            找到 <span className="font-bold text-rose-600 text-sm">{groups.groups.length}</span> 组重复行，
            共涉及 <span className="font-bold text-rose-600 text-sm">{formatNumber(groups.count)}</span> 行
          </div>
          {groups.groups.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {groups.groups.slice(0, 10).map((g, idx) => (
                <div key={idx} className="text-[11px] flex items-center gap-2 px-2 py-1 rounded bg-white border border-slate-200">
                  <Badge variant="danger" size="sm">
                    #{idx + 1} × {g.length}
                  </Badge>
                  <span className="truncate text-slate-600">
                    行号：{g.map((r) => r._index + 1).join(', ')}
                  </span>
                </div>
              ))}
              {groups.groups.length > 10 && (
                <div className="text-[11px] text-slate-400 px-2">... 还有 {groups.groups.length - 10} 组</div>
              )}
            </div>
          )}
        </div>
        <Checkbox checked={keepFirst} onChange={setKeepFirst} label="保留每组第一条（关闭则保留最后一条）" />
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const ids = groups.groups.flatMap((g) => g.map((r) => r._id));
              setSelectedRows(new Set(ids));
              showToast({ type: 'info', message: `已选中 ${formatNumber(ids.length)} 个重复行` });
            }}
            leftIcon={<ListChecks size={14} />}
          >
            选中重复行
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const targetCols = cols.length > 0 ? cols : f.headers;
              const before = f.rowCount;
              updateActiveFile((file) => cleaner.removeDuplicates(file, targetCols, keepFirst), true);
              addStep({ type: 'REMOVE_DUPLICATES', payload: { columns: targetCols, keepFirst }, label: '去重' });
              const after = useFileStore.getState().getActiveFile()?.rowCount ?? 0;
              showToast({ type: 'success', message: `已去重，删除 ${formatNumber(before - after)} 行` });
            }}
            leftIcon={<Trash2 size={14} />}
          >
            一键去重
          </Button>
        </div>
      </div>
    </div>
  );
};

const BulkReplace: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [column, setColumn] = useState<string>('__ALL__');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(true);

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          label="目标列"
          value={column}
          onChange={setColumn}
          options={[
            { label: '📋 所有列', value: '__ALL__' },
            ...f.headers.map((h) => ({ label: h, value: h })),
          ]}
        />
        <Input label="查找内容" value={find} onChange={setFind} placeholder="要查找的文本" />
        <Input label="替换为" value={replace} onChange={setReplace} placeholder="替换后的文本（可留空）" />
        <div className="flex items-end gap-2">
          <Button
            variant="primary"
            disabled={!find}
            onClick={() => {
              updateActiveFile(
                (file) => cleaner.bulkReplace(file, column, find, replace, useRegex),
                true
              );
              addStep({ type: 'REPLACE', payload: { column, find, replace, regex: useRegex }, label: `替换 "${find}" → "${replace}"` });
              showToast({ type: 'success', message: '批量替换完成' });
            }}
            leftIcon={<Wand2 size={14} />}
          >
            执行替换
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <Checkbox checked={useRegex} onChange={setUseRegex} label="使用正则表达式" />
        <Checkbox checked={!caseSensitive} onChange={(c) => setCaseSensitive(!c)} label="忽略大小写" />
      </div>
      <div className="text-xs text-slate-500 bg-sky-50 border border-sky-200 rounded-lg p-3">
        📝 支持正则：如查找 <code>\d+</code> 替换为 <code>NUM</code> 可将所有数字替换
      </div>
    </div>
  );
};

const opLabels: Record<FilterCondition['operator'], string> = {
  eq: '等于',
  ne: '不等于',
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
  contains: '包含',
  startsWith: '开头是',
  endsWith: '结尾是',
  isNull: '为空',
  isNotNull: '不为空',
  regex: '正则匹配',
};

const FilterBuilder: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { column: f.headers[0] ?? '', operator: 'contains', value: '', caseSensitive: false },
  ]);

  const ops: FilterCondition['operator'][] = [
    'contains', 'eq', 'ne', 'startsWith', 'endsWith', 'gt', 'lt', 'gte', 'lte', 'isNull', 'isNotNull', 'regex',
  ];
  const valueOps: FilterCondition['operator'][] = ['isNull', 'isNotNull'];

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">条件逻辑：</span>
        <Tabs
          size="sm"
          activeId={logic}
          onChange={(id) => setLogic(id as any)}
          items={[
            { id: 'AND', label: '并且 (全部满足)' },
            { id: 'OR', label: '或者 (任一满足)' },
          ]}
        />
      </div>

      <div className="space-y-2">
        {conditions.map((c, idx) => (
          <div key={idx} className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
              {idx + 1}
            </div>
            <div className="w-48">
              <Select
                value={c.column}
                onChange={(v) => {
                  const next = [...conditions];
                  next[idx] = { ...c, column: v };
                  setConditions(next);
                }}
                options={f.headers.map((h) => ({ label: h, value: h }))}
              />
            </div>
            <div className="w-40">
              <Select
                value={c.operator}
                onChange={(v) => {
                  const next = [...conditions];
                  next[idx] = { ...c, operator: v as any };
                  setConditions(next);
                }}
                options={ops.map((o) => ({ label: opLabels[o], value: o }))}
              />
            </div>
            {!valueOps.includes(c.operator) && (
              <div className="flex-1 min-w-[160px]">
                <Input
                  value={c.value}
                  onChange={(v) => {
                    const next = [...conditions];
                    next[idx] = { ...c, value: v };
                    setConditions(next);
                  }}
                  placeholder="比较值"
                />
              </div>
            )}
            {!valueOps.includes(c.operator) && (
              <Checkbox
                checked={!c.caseSensitive}
                onChange={(cs) => {
                  const next = [...conditions];
                  next[idx] = { ...c, caseSensitive: !cs };
                  setConditions(next);
                }}
                label="忽略大小写"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => conditions.length > 1 && setConditions(conditions.filter((_, i) => i !== idx))}
              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setConditions([...conditions, { column: f.headers[0] ?? '', operator: 'contains', value: '', caseSensitive: false }])
          }
          leftIcon={<Search size={14} />}
        >
          + 添加条件
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const valids = conditions.filter((c) => c.column && (valueOps.includes(c.operator) || c.value !== ''));
            if (valids.length === 0) {
              showToast({ type: 'warning', message: '请至少填写一个有效条件' });
              return;
            }
            const before = f.rowCount;
            updateActiveFile((file) => cleaner.filterRows(file, valids, logic), true);
            addStep({ type: 'FILTER', payload: { conditions: valids, logic }, label: `筛选 ${valids.length} 条件 (${logic})` });
            const after = useFileStore.getState().getActiveFile()?.rowCount ?? 0;
            showToast({ type: 'success', message: `筛选完成，保留 ${formatNumber(after)} / ${formatNumber(before)} 行` });
          }}
          leftIcon={<Target size={14} />}
        >
          执行筛选（删除不满足行）
        </Button>
      </div>
    </div>
  );
};

const ErrorLocator: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile, selectedRowIds, setSelectedRows, setSelectedColumn } = useFileStore();
  const { showToast } = useUiStore();
  const [cols, setCols] = useState<string[]>([]);
  const [errors, setErrors] = useState(() => locateErrors(f, cols));

  React.useEffect(() => {
    setErrors(locateErrors(f, cols));
  }, [f, cols]);

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <ColumnCheckList headers={f.headers} value={cols} onChange={setCols} />

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <div className="text-xs text-slate-500 mb-2">
          根据列推断类型定位数据错误：共发现{' '}
          <span className="font-bold text-rose-600 text-sm">{formatNumber(errors.length)}</span> 行异常
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1.5">
          {errors.length === 0 && (
            <div className="text-xs text-slate-400 py-6 text-center">
              🎉 没有发现类型错误，数据质量良好！
            </div>
          )}
          {errors.slice(0, 100).map((e) => (
            <div
              key={e.rowId}
              className="text-[11px] flex items-start gap-2 px-3 py-2 rounded bg-white border border-rose-100 hover:bg-rose-50 cursor-pointer"
              onClick={() => {
                setSelectedRows((prev) => {
                  const n = new Set(prev);
                  n.add(e.rowId);
                  return n;
                });
              }}
            >
              <Badge variant="danger" size="sm">
                行 {e.rowIndex + 1}
              </Badge>
              <div className="flex-1 space-y-0.5">
                {e.issues.map((iss, i) => (
                  <div key={i} className="text-slate-600">{iss}</div>
                ))}
              </div>
              <ScanEye size={12} className="text-rose-500 flex-shrink-0 mt-0.5" />
            </div>
          ))}
          {errors.length > 100 && (
            <div className="text-[11px] text-slate-400 px-3 py-2">仅显示前 100 条，共 {errors.length} 条</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedRows(new Set(errors.map((e) => e.rowId)));
            showToast({ type: 'info', message: `已选中 ${errors.length} 行异常数据` });
          }}
          leftIcon={<ListChecks size={14} />}
        >
          选中所有异常行
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            const ids = new Set(errors.map((e) => e.rowId));
            updateActiveFile((file) => ({ ...file, rows: file.rows.filter((r) => !ids.has(r._id)) }), true);
            showToast({ type: 'success', message: `删除了 ${errors.length} 行异常数据` });
          }}
          leftIcon={<Trash2 size={14} />}
          disabled={errors.length === 0}
        >
          删除所有异常行
        </Button>
      </div>
    </div>
  );
};
