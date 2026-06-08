import React, { useMemo, useState } from 'react';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import {
  compareFiles,
  mergeFiles,
  buildMerge,
  keyQualityCheck,
  type JoinMode,
  type ConflictStrategy,
  type KeyQualityIssue,
  type MergeTrackingOptions,
} from '../../engine/differ';
import type { DiffResult } from '../../engine/types';
import { Button } from '../common/Button';
import { Select, Checkbox, Input } from '../common/Form';
import { Badge } from '../common/Badge';
import { Tabs } from '../common/Tabs';
import { formatNumber } from '../../utils/detectType';
import { cn } from '../../lib/utils';
import {
  ArrowLeftRight,
  GitMerge,
  CircleCheck,
  CircleMinus,
  CirclePlus,
  GitCompare,
  AlertCircle,
  Hash,
  Target,
  Eye,
  Layers,
  FileOutput,
  ListTree,
  AlertTriangle,
  Info,
  XCircle,
  ShieldAlert,
  BadgeCheck,
  Shapes,
  Sparkles,
} from 'lucide-react';

type ViewMode = 'quality' | 'diff' | 'side' | 'merge-preview';

const ISSUE_ICON: Record<string, React.ReactNode> = {
  left_null: <XCircle size={14} className="text-rose-500" />,
  right_null: <XCircle size={14} className="text-rose-500" />,
  left_duplicate: <AlertTriangle size={14} className="text-amber-500" />,
  right_duplicate: <AlertTriangle size={14} className="text-amber-500" />,
  one_to_many: <Shapes size={14} className="text-violet-500" />,
  many_to_one: <Sparkles size={14} className="text-sky-500" />,
};

const RISK_BADGE: Record<string, { label: string; variant: any }> = {
  low: { label: '✅ 低风险', variant: 'success' },
  medium: { label: '⚠️ 中风险', variant: 'warning' },
  high: { label: '🚨 高风险', variant: 'danger' },
};

export const ComparePanel: React.FC = () => {
  const { files, activeFileId, addFile } = useFileStore();
  const { compareFileId, setCompareFileId, showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const others = files.filter((f) => f.id !== activeFileId);

  const [keys, setKeys] = useState<string[]>([]);
  const [joinMode, setJoinMode] = useState<JoinMode>('full');
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('keep_both');
  const [view, setView] = useState<ViewMode>('quality');
  const [leftSuffix, setLeftSuffix] = useState('_左表');
  const [rightSuffix, setRightSuffix] = useState('_右表');

  // 来源追踪选项
  const [trackStatus, setTrackStatus] = useState(true);
  const [trackLeftRow, setTrackLeftRow] = useState(true);
  const [trackRightRow, setTrackRightRow] = useState(true);

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

  const tracking: MergeTrackingOptions = useMemo(
    () => ({
      addStatusColumn: trackStatus,
      addLeftRowIndex: trackLeftRow,
      addRightRowIndex: trackRightRow,
    }),
    [trackStatus, trackLeftRow, trackRightRow]
  );

  const mergePreview = useMemo(() => {
    if (!leftFile || !rightFile || keys.length === 0) return null;
    try {
      return buildMerge(leftFile, rightFile, keys, {
        mode: joinMode,
        suffixes: { left: leftSuffix, right: rightSuffix },
        conflictStrategy,
        ...tracking,
      });
    } catch {
      return null;
    }
  }, [leftFile, rightFile, keys.join('|'), joinMode, conflictStrategy, leftSuffix, rightSuffix, trackStatus, trackLeftRow, trackRightRow]);

  const qualityReport = useMemo(() => {
    if (!leftFile || !rightFile || keys.length === 0) return null;
    try {
      return keyQualityCheck(leftFile, rightFile, keys);
    } catch {
      return null;
    }
  }, [leftFile, rightFile, keys.join('|')]);

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
  const strategyDisabled = conflictStrategy !== 'keep_both';
  const risk = qualityReport ? RISK_BADGE[qualityReport.overallRisk] : RISK_BADGE.low;

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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <Select
            label="比对/连接模式"
            value={joinMode}
            onChange={(v) => setJoinMode(v as JoinMode)}
            className="md:col-span-3"
            options={[
              { label: '完全外连接 (FULL)', value: 'full' },
              { label: '左连接 (LEFT)', value: 'left' },
              { label: '右连接 (RIGHT)', value: 'right' },
              { label: '内连接 (INNER)', value: 'inner' },
            ]}
          />
          <Select
            label="冲突列处理策略"
            value={conflictStrategy}
            onChange={(v) => setConflictStrategy(v as ConflictStrategy)}
            className="md:col-span-4"
            options={[
              { label: '保留左右两列（加后缀区分）', value: 'keep_both' },
              { label: '只保留左表的值', value: 'keep_left' },
              { label: '只保留右表的值', value: 'keep_right' },
              { label: '右表有值就覆盖左表（否则保留左表）', value: 'right_coalesce' },
            ]}
          />
          <Select
            label="展示方式"
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            className="md:col-span-2"
            options={[
              { label: '键质量检查', value: 'quality' },
              { label: '差异统计', value: 'diff' },
              { label: '合并预览', value: 'merge-preview' },
              { label: '双表并排', value: 'side' },
            ]}
          />
          <div className="md:col-span-3">
            <Button
              variant="primary"
              disabled={keys.length === 0 || !rightFile || !mergePreview || qualityReport?.hasCriticalIssue}
              leftIcon={<GitMerge size={14} />}
              className="w-full"
              onClick={() => {
                if (!leftFile || !rightFile) return;
                const { file } = mergeFiles(
                  leftFile,
                  rightFile,
                  keys,
                  joinMode,
                  { left: leftSuffix, right: rightSuffix },
                  conflictStrategy,
                  tracking
                );
                addFile(file);
                addStep({
                  type: 'COMPARE',
                  payload: {
                    otherFileId: rightFile.id,
                    keys,
                    mode: joinMode,
                    conflictStrategy,
                    suffixes: { left: leftSuffix, right: rightSuffix },
                    tracking,
                  },
                  label: `合并 ${leftFile.name} ⇄ ${rightFile.name}（${joinMode}）`,
                });
                showToast({ type: 'success', message: `已生成合并结果：${file.name}（${formatNumber(file.rowCount)} 行）` });
              }}
            >
              生成合并表
            </Button>
            {qualityReport?.hasCriticalIssue && (
              <div className="text-[10.5px] text-rose-500 mt-1">
                ⚠️ 检测到严重质量问题，已禁用生成；请先修复关联键
              </div>
            )}
          </div>
        </div>

        {(view === 'merge-preview' || view === 'side' || true) && (
          <div className="pt-1 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <BadgeCheck size={12} /> 来源追踪列（加到合并表的最前面，方便后续按来源筛选/定位）
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Checkbox checked={trackStatus} onChange={setTrackStatus} label="匹配状态列（_匹配状态：不变/修改/左独有/右独有）" />
              <Checkbox checked={trackLeftRow} onChange={setTrackLeftRow} label="左表原行号列（_左表原行号）" />
              <Checkbox checked={trackRightRow} onChange={setTrackRightRow} label="右表原行号列（_右表原行号）" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Input label="冲突列后缀（左表）" value={leftSuffix} onChange={setLeftSuffix} placeholder="_左表" disabled={strategyDisabled} />
              <Input label="冲突列后缀（右表）" value={rightSuffix} onChange={setRightSuffix} placeholder="_右表" disabled={strategyDisabled} />
            </div>
          </div>
        )}
      </div>

      {/* 1. 键质量检查 */}
      {view === 'quality' && qualityReport && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden space-y-3 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldAlert size={16} /> 关联键质量检查
            </div>
            <Badge variant={risk.variant} size="sm">
              {risk.label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-7 gap-2.5">
            <MiniStat icon={<Layers size={12} />} label="左表总行" value={formatNumber(qualityReport.leftRows)} color="teal" />
            <MiniStat icon={<Layers size={12} />} label="右表总行" value={formatNumber(qualityReport.rightRows)} color="sky" />
            <MiniStat icon={<Hash size={12} />} label="左唯一键" value={formatNumber(qualityReport.leftUniqueKeys)} color="emerald" />
            <MiniStat icon={<Hash size={12} />} label="右唯一键" value={formatNumber(qualityReport.rightUniqueKeys)} color="emerald" />
            <MiniStat icon={<ArrowLeftRight size={12} />} label="两边共有" value={formatNumber(qualityReport.keysExistInBoth)} color="indigo" />
            <MiniStat icon={<CircleMinus size={12} />} label="仅左表有" value={formatNumber(qualityReport.keysOnlyLeft)} color="rose" />
            <MiniStat icon={<CirclePlus size={12} />} label="仅右表有" value={formatNumber(qualityReport.keysOnlyRight)} color="amber" />
          </div>

          {qualityReport.issues.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
              <BadgeCheck size={28} className="text-emerald-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-emerald-800">🎉 关联键质量极佳</div>
              <div className="text-xs text-emerald-600 mt-1">无重复键、无空键、匹配关系均匀</div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {qualityReport.issues.map((issue, i) => (
                <QualityIssueCard key={i} issue={issue} keys={keys} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. 合并预览 */}
      {mergePreview && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
            <Eye size={15} /> 生成前预览
            <Badge size="sm" variant="info" className="ml-2">
              连接模式：{joinMode.toUpperCase()}
            </Badge>
            <Badge size="sm" variant="default" className="ml-1">
              冲突策略：{conflictStrategy}
            </Badge>
            {(trackStatus || trackLeftRow || trackRightRow) && (
              <Badge size="sm" variant="success" className="ml-1">
                含追踪列
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
            <MiniStat icon={<FileOutput size={13} />} label="输出总行数" value={formatNumber(mergePreview.summary.totalRows)} color="indigo" />
            <MiniStat icon={<Layers size={13} />} label="双表共同匹配" value={formatNumber(mergePreview.summary.bothMatched)} color="emerald" />
            <MiniStat icon={<CircleCheck size={13} />} label="左表匹配数" value={formatNumber(mergePreview.summary.leftMatched)} color="teal" />
            <MiniStat icon={<CircleCheck size={13} />} label="右表匹配数" value={formatNumber(mergePreview.summary.rightMatched)} color="sky" />
            <MiniStat icon={<CircleMinus size={13} />} label="左表未匹配" value={formatNumber(mergePreview.summary.unmatchedLeft)} color="rose" />
            <MiniStat icon={<CirclePlus size={13} />} label="右表未匹配" value={formatNumber(mergePreview.summary.unmatchedRight)} color="amber" />
          </div>
          <div className="rounded-lg border border-indigo-200 bg-white overflow-hidden">
            <div className="px-3 py-2 bg-indigo-50/70 border-b border-indigo-200 flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
                <ListTree size={13} /> 合并结果预览（前 30 行，共 {formatNumber(mergePreview.headers.length)} 列）
              </div>
              <Badge variant="default" size="sm">
                {mergePreview.summary.totalRows > 30 ? `省略 ${formatNumber(mergePreview.summary.totalRows - 30)} 行` : '已展示全部'}
              </Badge>
            </div>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8 border-r border-slate-200">#</th>
                    <th className="px-2 py-1.5 text-left w-16 border-r border-slate-200">状态</th>
                    {mergePreview.headers.map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'px-2 py-1.5 text-left border-r border-slate-200 whitespace-nowrap font-medium text-slate-700',
                          mergePreview.conflictingCols.includes(h) && 'bg-amber-50 text-amber-800',
                          h.startsWith('_') && 'bg-sky-50 text-sky-800'
                        )}
                      >
                        {h}
                        {mergePreview.conflictingCols.includes(h) && <span className="ml-1 text-[9px] text-amber-600">[冲突]</span>}
                        {h.startsWith('_') && <span className="ml-1 text-[9px] text-sky-600">[追踪]</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mergePreview.rows.slice(0, 30).map((r, i) => {
                    const statusBadge = {
                      unchanged: { label: '不变', variant: 'default' as const, cls: 'bg-white' },
                      modified: { label: '修改', variant: 'warning' as const, cls: 'bg-amber-50' },
                      'left-only': { label: '左独有', variant: 'danger' as const, cls: 'bg-rose-50' },
                      'right-only': { label: '右独有', variant: 'success' as const, cls: 'bg-emerald-50' },
                    }[r.status] ?? { label: '-', variant: 'default' as const, cls: 'bg-white' };
                    return (
                      <tr key={i} className={statusBadge.cls}>
                        <td className="px-2 py-1 border-r border-slate-100 text-slate-400 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1 border-r border-slate-100">
                          <Badge variant={statusBadge.variant} size="sm">
                            {statusBadge.label}
                          </Badge>
                        </td>
                        {mergePreview.headers.map((h) => (
                          <td key={h} className="px-2 py-1 border-r border-slate-100 whitespace-nowrap">
                            {fmt(r.values[h])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {mergePreview.rows.length === 0 && (
                    <tr>
                      <td colSpan={mergePreview.headers.length + 2} className="px-4 py-8 text-center text-xs text-slate-400">
                        当前连接模式下无输出行
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. 差异统计 */}
      {diff && view === 'diff' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard icon={<CircleCheck size={16} className="text-emerald-600" />} label="完全匹配" value={formatNumber(diff.stats.bothSame)} color="emerald" />
            <StatCard icon={<CircleMinus size={16} className="text-rose-600" />} label="仅左表有" value={formatNumber(diff.stats.leftOnly)} color="rose" />
            <StatCard icon={<CirclePlus size={16} className="text-sky-600" />} label="仅右表有" value={formatNumber(diff.stats.rightOnly)} color="sky" />
            <StatCard icon={<AlertCircle size={16} className="text-amber-600" />} label="值有差异" value={formatNumber(diff.stats.bothChanged)} color="amber" />
            <StatCard icon={<GitCompare size={16} className="text-violet-600" />} label="总差异行" value={formatNumber(diff.stats.totalDiff)} color="violet" />
          </div>

          <div className="space-y-3">
            <DiffSection title="仅在左表存在的行（右表缺失）" rows={diff.removed.slice(0, 50)} headers={leftFile.headers} rowClass="bg-rose-50 hover:bg-rose-100" badge="左表独有" badgeVariant="danger" emptyText="✅ 左表中所有行在右表均有匹配" />
            <DiffSection title="仅在右表存在的行（左表缺失）" rows={diff.added.slice(0, 50)} headers={rightFile.headers} rowClass="bg-emerald-50 hover:bg-emerald-100" badge="右表新增" badgeVariant="success" emptyText="✅ 右表中没有额外的新行" />
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
                          <td className="px-2 py-1 border-r border-amber-100 text-slate-400" rowSpan={2}>{i + 1}</td>
                          <td className="px-2 py-1 border-r border-amber-100"><Badge size="sm" variant="danger">左</Badge></td>
                          {allHeaders.map((h) => (
                            <td key={h} className={cn('px-2 py-1 border-r border-amber-100 whitespace-nowrap', m.changedColumns.includes(h) && 'bg-rose-100/80 text-rose-900 font-semibold')}>
                              {fmt(m.left.values[h])}
                            </td>
                          ))}
                        </tr>,
                        <tr key={`r-${i}`} className="border-b-2 border-amber-200">
                          <td className="px-2 py-1 border-r border-amber-100"><Badge size="sm" variant="success">右</Badge></td>
                          {allHeaders.map((h) => (
                            <td key={h} className={cn('px-2 py-1 border-r border-amber-100 whitespace-nowrap', m.changedColumns.includes(h) && 'bg-emerald-100/80 text-emerald-900 font-semibold')}>
                              {fmt(m.right.values[h])}
                            </td>
                          ))}
                        </tr>,
                      ])}
                    </tbody>
                  </table>
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

const QualityIssueCard: React.FC<{ issue: KeyQualityIssue; keys: string[] }> = ({ issue, keys }) => {
  const [open, setOpen] = useState(true);
  const bgMap: Record<string, string> = { error: 'border-rose-200 bg-rose-50/40', warning: 'border-amber-200 bg-amber-50/40', info: 'border-sky-200 bg-sky-50/40' };
  const titleMap: Record<string, string> = { error: '严重错误', warning: '警告', info: '提示' };
  const variantMap: Record<string, any> = { error: 'danger', warning: 'warning', info: 'info' };
  return (
    <div className={cn('rounded-lg border overflow-hidden', bgMap[issue.severity])}>
      <button className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0">{ISSUE_ICON[issue.type]}</div>
          <div className="text-xs font-semibold text-slate-800 truncate">{issue.message}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge size="sm" variant={variantMap[issue.severity]}>{titleMap[issue.severity]}</Badge>
          <Badge size="sm" variant="default">{formatNumber(issue.count)}</Badge>
          <span className={cn('text-slate-400 transition-transform text-xs', open && 'rotate-180')}>▼</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/60 max-h-60 overflow-auto bg-white">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1 text-left w-8">#</th>
                {keys.map((k) => (
                  <th key={k} className="px-2 py-1 text-left whitespace-nowrap border-r border-slate-200">{k}</th>
                ))}
                <th className="px-2 py-1 text-left whitespace-nowrap w-24">行号</th>
                {issue.sampleRows.some((s) => s.extra) && <th className="px-2 py-1 text-left whitespace-nowrap">备注</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issue.sampleRows.map((r, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-slate-400 tabular-nums">{i + 1}</td>
                  {keys.map((k) => (
                    <td key={k} className="px-2 py-1 whitespace-nowrap border-r border-slate-100">{fmt(r.values?.[k])}</td>
                  ))}
                  <td className="px-2 py-1 whitespace-nowrap text-slate-600 tabular-nums">{r.rowIndex !== undefined ? r.rowIndex + 1 : '-'}</td>
                  {issue.sampleRows.some((s) => s.extra) && <td className="px-2 py-1 whitespace-nowrap text-slate-500">{r.extra ?? '-'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => {
  const map: Record<string, string> = { indigo: 'from-indigo-500 to-indigo-600', emerald: 'from-emerald-500 to-emerald-600', teal: 'from-teal-500 to-teal-600', sky: 'from-sky-500 to-sky-600', rose: 'from-rose-500 to-rose-600', amber: 'from-amber-500 to-amber-600', violet: 'from-violet-500 to-violet-600' };
  return (
    <div className="relative rounded-lg border border-white bg-white/80 p-2.5 overflow-hidden shadow-sm">
      <div className={cn('absolute -top-8 -right-8 w-16 h-16 rounded-full bg-gradient-to-br opacity-10', map[color])} />
      <div className="relative flex items-center gap-1.5 text-slate-500">
        {icon}
        <span className="text-[10.5px] font-medium">{label}</span>
      </div>
      <div className="relative mt-0.5 text-base font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => {
  const colorMap: Record<string, string> = { emerald: 'from-emerald-500 to-emerald-600', rose: 'from-rose-500 to-rose-600', sky: 'from-sky-500 to-sky-600', amber: 'from-amber-500 to-amber-600', violet: 'from-violet-500 to-violet-600' };
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-3 overflow-hidden">
      <div className={cn('absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br opacity-10', colorMap[color])} />
      <div className="relative">
        <div className="flex items-center gap-1.5">{icon}</div>
        <div className="mt-0.5 text-[11px] text-slate-500 font-medium">{label}</div>
        <div className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{value}</div>
      </div>
    </div>
  );
};

const DiffSection: React.FC<{ title: string; rows: any[]; headers: string[]; rowClass: string; badge: string; badgeVariant: any; emptyText: string }> = ({ title, rows, headers, rowClass, badge, badgeVariant, emptyText }) => (
  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
    <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
      <div className="text-sm font-semibold text-slate-800">{title} {rows.length > 0 && <span className="text-slate-400 text-xs ml-1">(仅前 50 行)</span>}</div>
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
                <th key={h} className="px-2 py-1.5 text-left border-r border-slate-200 whitespace-nowrap font-medium text-slate-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className={rowClass}>
                <td className="px-2 py-1 text-slate-400 tabular-nums">{i + 1}</td>
                {headers.map((h) => (
                  <td key={h} className="px-2 py-1 border-r border-slate-100 whitespace-nowrap">{fmt(r.values[h])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
