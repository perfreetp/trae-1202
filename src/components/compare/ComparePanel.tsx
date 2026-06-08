import React, { useMemo, useState } from 'react';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { compareFiles, mergeFiles, type JoinMode } from '../../engine/differ';
import type { DiffResult } from '../../engine/types';
import { Button } from '../common/Button';
import { Select, Checkbox, Input } from '../common/Form';
import { Badge } from '../common/Badge';
import { Tabs } from '../common/Tabs';
import { formatNumber } from '../../utils/detectType';
import { cn } from '../../lib/utils';
import { ArrowLeftRight, GitMerge, CircleCheck, CircleMinus, CirclePlus, GitCompare, AlertCircle, Hash, Target } from 'lucide-react';

type ViewMode = 'diff' | 'side';

export const ComparePanel: React.FC = () => {
  const { files, activeFileId, addFile } = useFileStore();
  const { compareFileId, setCompareFileId, showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const others = files.filter((f) => f.id !== activeFileId);

  const [keys, setKeys] = useState<string[]>([]);
  const [joinMode, setJoinMode] = useState<JoinMode>('full');
  const [view, setView] = useState<ViewMode>('diff');
  const [leftSuffix, setLeftSuffix] = useState('_左表');
  const [rightSuffix, setRightSuffix] = useState('_右表');

  const leftFile = files.find((f) => f.id === activeFileId);
  const rightFile = files.find((f) => f.id === compareFileId);

  const diff: DiffResult | null = useMemo(() => {
    if (!leftFile || !rightFile || keys.length === 0) return null;
    try {
      return compareFiles(leftFile, rightFile, keys, joinMode);
    } catch {
      return null;
    }
  }, [leftFile, rightFile, keys.join('|'), joinMode]);

  if (files.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <GitCompare size={40} className="text-slate-300 mx-auto mb-3" />
        <div className="text-sm font-medium text-slate-600">至少需要导入 2 个文件才能进行比对</div>
        <div className="text-xs text-slate-400 mt-1">请先在「文件区」导入多张 CSV 表</div>
      </div>
    );
  }

  if (!leftFile) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-sm text-slate-400">
        请选择左侧一个文件作为主表（点击文件卡片）
      </div>
    );
  }

  const allHeaders = Array.from(new Set([...(leftFile?.headers ?? []), ...(rightFile?.headers ?? [])]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-teal-300 bg-teal-50/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CircleMinus size={16} className="text-rose-600" />
            <div className="text-sm font-semibold text-slate-800">左表（主表）</div>
          </div>
          <div className="text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-teal-200">
            📄 {leftFile.name}
            <div className="mt-0.5 text-slate-400">{formatNumber(leftFile.rowCount)} 行 · {leftFile.headers.length} 列</div>
          </div>
        </div>
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CirclePlus size={16} className="text-emerald-600" />
            <div className="text-sm font-semibold text-slate-800">右表（对比表）</div>
          </div>
          <Select
            value={compareFileId ?? ''}
            onChange={setCompareFileId}
            placeholder="请选择右表..."
            options={others.map((f) => ({ label: `${f.name} (${formatNumber(f.rowCount)}行)`, value: f.id }))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Target size={13} /> 关联键（用于匹配两表的行，可多选作为复合主键）
          </div>
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
            {allHeaders.map((h) => {
              const active = keys.includes(h);
              return (
                <button
                  key={h}
                  onClick={() => setKeys(active ? keys.filter((x) => x !== h) : [...keys, h])}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md border transition',
                    active
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
                  )}
                >
                  {active ? '🔑 ' : ''}
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <Select
            label="比对/连接模式"
            value={joinMode}
            onChange={(v) => setJoinMode(v as JoinMode)}
            options={[
              { label: '完全外连接 (FULL)', value: 'full' },
              { label: '左连接 (LEFT)', value: 'left' },
              { label: '右连接 (RIGHT)', value: 'right' },
              { label: '内连接 (INNER)', value: 'inner' },
            ]}
          />
          <Select
            label="展示方式"
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={[
              { label: '差异统计', value: 'diff' },
              { label: '双表并排', value: 'side' },
            ]}
          />
          <Button
            variant="primary"
            disabled={keys.length === 0 || !rightFile}
            leftIcon={<GitMerge size={14} />}
            onClick={() => {
              if (!leftFile || !rightFile) return;
              const { file } = mergeFiles(leftFile, rightFile, keys, joinMode, { left: leftSuffix, right: rightSuffix });
              addFile(file);
              addStep({
                type: 'COMPARE',
                payload: { otherFileId: rightFile.id, keys, mode: joinMode },
                label: `合并 ${leftFile.name} ⇄ ${rightFile.name}`,
              });
              showToast({ type: 'success', message: `已生成合并结果：${file.name}` });
            }}
          >
            生成合并表
          </Button>
        </div>

        {view === 'side' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="冲突列后缀（左表）" value={leftSuffix} onChange={setLeftSuffix} placeholder="_A / _左 ..." />
            <Input label="冲突列后缀（右表）" value={rightSuffix} onChange={setRightSuffix} placeholder="_B / _右 ..." />
          </div>
        )}
      </div>

      {diff && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              icon={<CircleCheck size={16} className="text-emerald-600" />}
              label="完全匹配"
              value={formatNumber(diff.stats.bothSame)}
              color="emerald"
            />
            <StatCard
              icon={<CircleMinus size={16} className="text-rose-600" />}
              label="仅左表有"
              value={formatNumber(diff.stats.leftOnly)}
              color="rose"
            />
            <StatCard
              icon={<CirclePlus size={16} className="text-sky-600" />}
              label="仅右表有"
              value={formatNumber(diff.stats.rightOnly)}
              color="sky"
            />
            <StatCard
              icon={<AlertCircle size={16} className="text-amber-600" />}
              label="值有差异"
              value={formatNumber(diff.stats.bothChanged)}
              color="amber"
            />
            <StatCard
              icon={<GitCompare size={16} className="text-violet-600" />}
              label="总差异行"
              value={formatNumber(diff.stats.totalDiff)}
              color="violet"
            />
          </div>

          <div className="space-y-3">
            <DiffSection
              title="仅在左表存在的行（右表缺失）"
              rows={diff.removed.slice(0, 50)}
              headers={leftFile.headers}
              rowClass="bg-rose-50 hover:bg-rose-100"
              badge="左表独有"
              badgeVariant="danger"
              emptyText="✅ 左表中所有行在右表均有匹配"
            />
            <DiffSection
              title="仅在右表存在的行（左表缺失）"
              rows={diff.added.slice(0, 50)}
              headers={rightFile.headers}
              rowClass="bg-emerald-50 hover:bg-emerald-100"
              badge="右表新增"
              badgeVariant="success"
              emptyText="✅ 右表中没有额外的新行"
            />
            {diff.modified.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/30 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50/60 flex items-center justify-between">
                  <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                    <AlertCircle size={16} /> 两表都存在但值有差异 ({formatNumber(diff.modified.length)} 行，仅展示前 30 行)
                  </div>
                  <Badge variant="warning">修改</Badge>
                </div>
                <div className="overflow-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-amber-100/60 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-1.5 text-left border-r border-amber-200 w-8">#</th>
                        <th className="px-2 py-1.5 text-left border-r border-amber-200 w-12">来源</th>
                        {allHeaders.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left border-r border-amber-200 whitespace-nowrap font-medium text-amber-900">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diff.modified.slice(0, 30).flatMap((m, i) => [
                        <tr key={`l-${i}`} className="border-b border-amber-100">
                          <td className="px-2 py-1 border-r border-amber-100 text-slate-400" rowSpan={2}>
                            {i + 1}
                          </td>
                          <td className="px-2 py-1 border-r border-amber-100">
                            <Badge size="sm" variant="danger">
                              左
                            </Badge>
                          </td>
                          {allHeaders.map((h) => (
                            <td
                              key={h}
                              className={cn(
                                'px-2 py-1 border-r border-amber-100 whitespace-nowrap',
                                m.changedColumns.includes(h) && 'bg-rose-100/80 text-rose-900 font-semibold'
                              )}
                            >
                              {fmt(m.left.values[h])}
                            </td>
                          ))}
                        </tr>,
                        <tr key={`r-${i}`} className="border-b-2 border-amber-200">
                          <td className="px-2 py-1 border-r border-amber-100">
                            <Badge size="sm" variant="success">
                              右
                            </Badge>
                          </td>
                          {allHeaders.map((h) => (
                            <td
                              key={h}
                              className={cn(
                                'px-2 py-1 border-r border-amber-100 whitespace-nowrap',
                                m.changedColumns.includes(h) && 'bg-emerald-100/80 text-emerald-900 font-semibold'
                              )}
                            >
                              {fmt(m.right.values[h])}
                            </td>
                          ))}
                        </tr>,
                      ])}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-amber-200 bg-amber-50/50 flex items-center gap-4 text-[11px] text-amber-800">
                  <Legend color="bg-rose-200" label="左表的值 (变更列)" />
                  <Legend color="bg-emerald-200" label="右表的值 (变更列)" />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300 italic">空</span> as unknown as string;
  return typeof v === 'number' ? formatNumber(v) : String(v);
};

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="inline-flex items-center gap-1.5">
    <span className={`w-3 h-3 rounded ${color} border border-slate-300`} />
    <span>{label}</span>
  </div>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'emerald' | 'rose' | 'sky' | 'amber' | 'violet';
}> = ({ icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600',
    rose: 'from-rose-500 to-rose-600',
    sky: 'from-sky-500 to-sky-600',
    amber: 'from-amber-500 to-amber-600',
    violet: 'from-violet-500 to-violet-600',
  };
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-3 overflow-hidden">
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${colorMap[color]} opacity-10`} />
      <div className="relative">
        <div className="flex items-center gap-1.5">{icon}</div>
        <div className="mt-0.5 text-[11px] text-slate-500 font-medium">{label}</div>
        <div className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{value}</div>
      </div>
    </div>
  );
};

const DiffSection: React.FC<{
  title: string;
  rows: any[];
  headers: string[];
  rowClass: string;
  badge: string;
  badgeVariant: any;
  emptyText: string;
}> = ({ title, rows, headers, rowClass, badge, badgeVariant, emptyText }) => (
  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
    <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
      <div className="text-sm font-semibold text-slate-800">
        {title} {rows.length > 0 && <span className="text-slate-400 text-xs ml-1">(仅前 50 行)</span>}
      </div>
      <Badge variant={badgeVariant}>{badge} · {formatNumber(rows.length)}</Badge>
    </div>
    {rows.length === 0 ? (
      <div className="p-8 text-center text-xs text-slate-400">{emptyText}</div>
    ) : (
      <div className="overflow-auto max-h-60">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1.5 text-left w-8">#</th>
              {headers.map((h) => (
                <th key={h} className="px-2 py-1.5 text-left border-r border-slate-200 whitespace-nowrap font-medium text-slate-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className={rowClass}>
                <td className="px-2 py-1 text-slate-400 tabular-nums">{i + 1}</td>
                {headers.map((h) => (
                  <td key={h} className="px-2 py-1 border-r border-slate-100 whitespace-nowrap">
                    {fmt(r.values[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
