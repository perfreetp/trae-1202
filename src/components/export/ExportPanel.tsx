import React, { useState, useMemo, useEffect } from 'react';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { exportFile, triggerDownload, type ExportFormat, type ExportRange, type ExportOptions } from '../../engine/exporter';
import type { CsvFile, DataRow } from '../../engine/types';
import { Button } from '../common/Button';
import { Select, Checkbox, Input } from '../common/Form';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { formatNumber, formatBytes, generateId } from '../../utils/detectType';
import { cn } from '../../lib/utils';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Settings2,
  Eye,
  FileOutput,
  Hash,
  Target,
  Layers,
  Save,
  FolderOpen,
  Trash2,
  Pencil,
  ListChecks,
  Star,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

const PREVIEW_ROW_LIMIT = 20;
const PRESETS_STORAGE_KEY = 'csv-workbench.export-presets.v1';

interface ExportPreset {
  id: string;
  name: string;
  createdAt: number;
  config: {
    format: ExportFormat;
    encoding: string;
    delimiter: string;
    range: ExportRange;
    includeHeader: boolean;
    bom: boolean;
    sampleSize: number;
    includeTrackingCols: boolean;
    columnMode: 'all' | 'custom';
    // columns 保存列名数组；若 columnMode=all 则忽略
    selectedColumns?: string[];
  };
}

function loadPresets(): ExportPreset[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function savePresets(presets: ExportPreset[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {}
}

function getExportScopeRows(f: CsvFile, range: ExportRange, selectedIds: Set<string>, sampleN: number): DataRow[] {
  switch (range) {
    case 'selected': {
      const ordered: DataRow[] = [];
      f.rows.forEach((r) => {
        if (selectedIds.has(r._id)) ordered.push(r);
      });
      return ordered;
    }
    case 'sample':
      return f.rows.slice(0, sampleN);
    case 'all':
    case 'filtered':
    default:
      return f.rows;
  }
}

export const ExportPanel: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile());
  const { selectedRowIds, clearSelection } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);

  // --- State ---
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [fileName, setFileName] = useState('');
  const [encoding, setEncoding] = useState('UTF-8');
  const [delimiter, setDelimiter] = useState(',');
  const [range, setRange] = useState<ExportRange>('all');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [bom, setBom] = useState(true);
  const [sampleSize, setSampleSize] = useState(100);
  const [cols, setCols] = useState<string[]>(f?.headers ?? []);
  const [includeTrackingCols, setIncludeTrackingCols] = useState(true);

  // --- Presets ---
  const [presets, setPresetsState] = useState<ExportPreset[]>(() => loadPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string>('');
  const [renameInput, setRenameInput] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const persistPresets = (next: ExportPreset[]) => {
    setPresetsState(next);
    savePresets(next);
  };

  // --- 初始化：首次加载 f 时设置默认值 ---
  useEffect(() => {
    if (f) {
      setCols(f.headers);
      setFileName(f.name.replace(/\.(csv|xlsx)$/i, '') + '_已处理');
    }
  }, [f?.id]);

  // --- 计算最终列（考虑追踪列 + 自定义列选择） ---
  const finalCols = useMemo(() => {
    const base = cols.length > 0 ? cols : (f?.headers ?? []);
    if (!includeTrackingCols || !f) return base;
    const tracking = ['_匹配状态', '_左表原行号', '_右表原行号'].filter((c) => f.headers.includes(c));
    return [...tracking.filter((c) => !base.includes(c)), ...base];
  }, [cols, includeTrackingCols, f?.id]);

  const hasAnyTrackingCol = f ? ['_匹配状态', '_左表原行号', '_右表原行号'].some((c) => f.headers.includes(c)) : false;

  const estimatedRows = range === 'all'
    ? f?.rowCount ?? 0
    : range === 'filtered'
    ? f?.rowCount ?? 0
    : range === 'selected'
    ? selectedRowIds.size
    : Math.min(sampleSize, f?.rowCount ?? 0);

  const finalFileName = useMemo(() => {
    if (!f) return `export.${format}`;
    const base = fileName?.trim() || f.name.replace(/\.(csv|xlsx)$/i, '');
    return `${base}.${format}`;
  }, [fileName, f?.name, format, f]);

  const scopeRows = useMemo(() => {
    if (!f) return [];
    return getExportScopeRows(f, range, selectedRowIds, sampleSize);
  }, [f, range, selectedRowIds, sampleSize, f?.id]);

  const previewRows = useMemo(() => scopeRows.slice(0, PREVIEW_ROW_LIMIT), [scopeRows]);

  const doExport = () => {
    if (!f) return;
    const options: ExportOptions = {
      format,
      fileName: fileName || f.name,
      encoding,
      delimiter,
      range,
      includeHeader,
      bom,
      sampleSize,
      selectedRowIds: Array.from(selectedRowIds),
      columns: finalCols,
    };
    try {
      const { blob, fileName: finalName } = exportFile(f, options);
      triggerDownload(blob, finalName);
      addStep({
        type: 'EXPORT',
        payload: { format, fileName: finalName, encoding },
        label: `导出 ${finalName} (${format.toUpperCase()})`,
      });
      showToast({ type: 'success', message: `导出成功：${finalName} (${formatBytes(blob.size)})` });
    } catch (e) {
      showToast({ type: 'error', message: `导出失败: ${(e as Error).message}` });
    }
  };

  const fmt = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return <span className="text-slate-300 italic">空</span> as unknown as string;
    return typeof v === 'number' ? formatNumber(v) : String(v);
  };

  const rangeLabel = {
    all: '全部数据',
    filtered: '筛选后',
    selected: '仅选中行',
    sample: `抽样前 ${formatNumber(sampleSize)} 行`,
  }[range];

  // --- Preset actions ---
  const handleSaveAsPreset = () => {
    const name = newPresetName.trim() || `方案 ${presets.length + 1}`;
    const preset: ExportPreset = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      config: {
        format,
        encoding,
        delimiter,
        range,
        includeHeader,
        bom,
        sampleSize,
        includeTrackingCols,
        columnMode: cols.length === f?.headers.length ? 'all' : 'custom',
        selectedColumns: cols.length === f?.headers.length ? undefined : [...cols],
      },
    };
    persistPresets([...presets, preset]);
    setSelectedPresetId(preset.id);
    setSaveModalOpen(false);
    setNewPresetName('');
    showToast({ type: 'success', message: `已保存导出方案：${name}` });
  };

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p || !f) return;
    const { config } = p;
    setFormat(config.format);
    setEncoding(config.encoding);
    setDelimiter(config.delimiter);
    setRange(config.range);
    setIncludeHeader(config.includeHeader);
    setBom(config.bom);
    setSampleSize(config.sampleSize);
    setIncludeTrackingCols(config.includeTrackingCols);
    if (config.columnMode === 'custom' && config.selectedColumns) {
      // 只保留当前文件中实际存在的列
      setCols(config.selectedColumns.filter((c) => f.headers.includes(c)));
    } else {
      setCols([...f.headers]);
    }
    setSelectedPresetId(id);
    setPresetMenuOpen(false);
    showToast({ type: 'success', message: `已套用方案：${p.name}` });
  };

  const handleDeletePreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`确定删除导出方案「${p.name}」？`)) return;
    const next = presets.filter((x) => x.id !== id);
    persistPresets(next);
    if (selectedPresetId === id) setSelectedPresetId('');
    showToast({ type: 'info', message: `已删除方案：${p.name}` });
  };

  const openRename = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setRenameTargetId(id);
    setRenameInput(p.name);
    setRenameModalOpen(true);
  };

  const confirmRename = () => {
    if (!renameTargetId) return;
    const name = renameInput.trim();
    if (!name) return;
    const next = presets.map((p) => (p.id === renameTargetId ? { ...p, name } : p));
    persistPresets(next);
    setRenameModalOpen(false);
    setRenameTargetId('');
    showToast({ type: 'success', message: `已重命名为：${name}` });
  };

  if (!f) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center space-y-3">
        <FileSpreadsheet size={40} className="text-slate-300 mx-auto" />
        <div className="text-sm font-medium text-slate-600">当前没有可导出的文件</div>
        <div className="text-xs text-slate-400">请先在「文件区」导入或生成处理后的文件</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Presets Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Star size={14} /> 导出方案库
            </div>
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setPresetMenuOpen(!presetMenuOpen)} rightIcon={presetMenuOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}>
                {presets.length} 个已保存方案
              </Button>
              {presetMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                  {presets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">暂无方案，点击「保存为方案」创建</div>
                  ) : (
                    <div className="py-1">
                      {presets.map((p) => (
                        <div key={p.id} className={cn('px-3 py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition')}>
                          <div className="flex items-center justify-between gap-2">
                            <button className="flex-1 text-left min-w-0" onClick={() => applyPreset(p.id)}>
                              <div className={cn('text-sm font-medium truncate', p.id === selectedPresetId ? 'text-teal-700' : 'text-slate-800')}>
                                {p.id === selectedPresetId && <span className="mr-1">✓</span>}
                                {p.name}
                              </div>
                              <div className="text-[10.5px] text-slate-400 truncate">
                                {p.config.format.toUpperCase()} · {p.config.encoding} · {p.config.range}
                              </div>
                            </button>
                            <div className="flex gap-1 shrink-0">
                              <button className="p-1.5 rounded hover:bg-slate-200 text-slate-500" onClick={(e) => { e.stopPropagation(); openRename(p.id); }} title="重命名">
                                <Pencil size={12} />
                              </button>
                              <button className="p-1.5 rounded hover:bg-rose-100 text-rose-500" onClick={(e) => { e.stopPropagation(); handleDeletePreset(p.id); }} title="删除">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Save size={14} />}
              onClick={() => { setNewPresetName(`导出方案 ${presets.length + 1}`); setSaveModalOpen(true); }}
            >
              保存为方案
            </Button>
            {selectedPresetId && (
              <Badge variant="info" size="sm">
                当前：{presets.find((p) => p.id === selectedPresetId)?.name ?? ''}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setFormat('csv')}
          className={cn(
            'rounded-xl border-2 p-5 text-left transition-all',
            format === 'csv' ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100' : 'border-slate-200 bg-white hover:border-slate-300'
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', format === 'csv' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500')}>
              <FileText size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">CSV 文本格式</div>
                {format === 'csv' && <CheckCircle2 size={18} className="text-teal-600" />}
              </div>
              <div className="text-xs text-slate-500 mt-1">兼容性最好，可用 Excel / 记事本打开；体积小</div>
              <div className="flex gap-1.5 mt-2">
                <Badge size="sm" variant="info">.csv</Badge>
                <Badge size="sm" variant="default">推荐</Badge>
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFormat('xlsx')}
          className={cn(
            'rounded-xl border-2 p-5 text-left transition-all',
            format === 'xlsx' ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300'
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', format === 'xlsx' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500')}>
              <FileSpreadsheet size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">Excel 工作簿</div>
                {format === 'xlsx' && <CheckCircle2 size={18} className="text-emerald-600" />}
              </div>
              <div className="text-xs text-slate-500 mt-1">原生 .xlsx 格式；保留列宽样式；直接双击打开</div>
              <div className="flex gap-1.5 mt-2">
                <Badge size="sm" variant="success">.xlsx</Badge>
                <Badge size="sm" variant="warning">Excel</Badge>
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Settings2 size={14} /> 基本设置
          </div>
          <Input label="文件名（不含扩展名）" value={fileName} onChange={setFileName} />
          <Select
            label="导出范围"
            value={range}
            onChange={(v) => setRange(v as ExportRange)}
            options={[
              { label: `全部数据 (${formatNumber(f.rowCount)} 行)`, value: 'all' },
              { label: '仅筛选后（保留全部，用于后续筛选功能）', value: 'filtered' },
              { label: `仅选中行 (${formatNumber(selectedRowIds.size)} 行)`, value: 'selected', disabled: selectedRowIds.size === 0 },
              { label: `抽样前 N 行`, value: 'sample' },
            ]}
          />
          {range === 'sample' && <Input label="抽样行数" type="number" value={String(sampleSize)} onChange={(v) => setSampleSize(Number(v) || 100)} />}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-700">导出列（<span className="text-teal-600">{cols.length}</span> / {f.headers.length}）</div>
              <div className="flex gap-1.5">
                <button className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600" onClick={() => setCols([...f.headers])}>全选</button>
                <button className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600" onClick={() => setCols([])}>清空</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded border border-slate-200 max-h-32 overflow-y-auto">
              {f.headers.map((h) => {
                const active = cols.includes(h);
                const isTracking = h.startsWith('_');
                return (
                  <button
                    key={h}
                    onClick={() => setCols(active ? cols.filter((x) => x !== h) : [...cols, h])}
                    className={cn(
                      'px-2 py-0.5 text-[11px] rounded border transition',
                      active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400',
                      isTracking && !active && 'border-sky-200 text-sky-700'
                    )}
                  >
                    {active ? '✓ ' : ''}
                    {h}
                    {isTracking && <span className="ml-0.5 text-[9px] opacity-70">[追踪]</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {hasAnyTrackingCol && (
            <Checkbox
              checked={includeTrackingCols}
              onChange={setIncludeTrackingCols}
              label="自动包含追踪列（_匹配状态/行号等，即使列没勾选也会加到最前面）"
            />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Settings2 size={14} /> 格式选项
          </div>
          {format === 'csv' ? (
            <>
              <Select
                label="字符编码"
                value={encoding}
                onChange={setEncoding}
                options={[
                  { label: 'UTF-8（通用，推荐）', value: 'UTF-8' },
                  { label: 'UTF-8 BOM（Excel 打开不乱码）', value: 'UTF-8' },
                  { label: 'GBK / 简体中文', value: 'GBK' },
                  { label: 'Big5 / 繁体中文', value: 'Big5' },
                ]}
              />
              <Select
                label="列分隔符"
                value={delimiter}
                onChange={setDelimiter}
                options={[
                  { label: '逗号 , （标准）', value: ',' },
                  { label: '制表符 Tab', value: '\t' },
                  { label: '分号 ;', value: ';' },
                  { label: '竖线 |', value: '|' },
                ]}
              />
              <Checkbox checked={bom} onChange={setBom} label="添加 UTF-8 BOM（解决 Excel 打开乱码）" />
            </>
          ) : (
            <div className="text-xs text-slate-500 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              ℹ️ Excel 格式自动使用 Unicode 编码，无需额外设置；列宽会根据内容自动调整
            </div>
          )}
          <Checkbox checked={includeHeader} onChange={setIncludeHeader} label="包含表头行（第一行为列名）" />
          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>将导出行数</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatNumber(estimatedRows)}</span>
            </div>
            <div className="flex justify-between">
              <span>将导出列数</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatNumber(finalCols.length)}</span>
            </div>
            <div className="flex justify-between">
              <span>导出格式</span>
              <Badge variant={format === 'csv' ? 'info' : 'success'} size="sm">.{format}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* 预览确认 */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/60 to-emerald-50/40 p-4 space-y-3">
        <div className="flex items-center flex-wrap gap-2 text-sm font-semibold text-teal-900">
          <Eye size={15} /> 导出前确认预览
          <Badge size="sm" variant="info" className="ml-2">文件名：{finalFileName}</Badge>
          <Badge size="sm" variant="success" className="ml-1">范围：{rangeLabel}</Badge>
          <Badge size="sm" variant="default" className="ml-1">表头：{includeHeader ? '包含' : '不包含'}</Badge>
          <Badge size="sm" variant="warning" className="ml-1">格式：{format.toUpperCase()}</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MiniStat icon={<FileOutput size={13} />} label="预计总导出" value={`${formatNumber(estimatedRows)} 行`} color="teal" />
          <MiniStat icon={<Layers size={13} />} label="当前预览显示" value={`${formatNumber(previewRows.length)} 行`} color="indigo" />
          <MiniStat icon={<Hash size={13} />} label="列数" value={`${formatNumber(finalCols.length)} 列`} color="amber" />
          <MiniStat icon={<ListChecks size={13} />} label="编码" value={format === 'xlsx' ? 'Unicode' : encoding + (bom ? ' +BOM' : '')} color="emerald" />
        </div>

        <div className="rounded-lg border border-teal-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-teal-50/70 border-b border-teal-200 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-semibold text-teal-900">
              {scopeRows.length > PREVIEW_ROW_LIMIT
                ? `前 ${PREVIEW_ROW_LIMIT} 行预览（省略 ${formatNumber(scopeRows.length - PREVIEW_ROW_LIMIT)} 行）`
                : previewRows.length > 0
                ? '已展示全部范围内的行'
                : '范围内无数据可导出'}
            </div>
            <div className="text-[11px] text-teal-700 truncate max-w-[60%]">
              列顺序：<span className="font-mono">{finalCols.length > 0 ? finalCols.join(' → ') : '（未选择任何列）'}</span>
            </div>
          </div>
          <div className="overflow-auto max-h-96">
            {finalCols.length === 0 ? (
              <div className="p-8 text-center text-xs text-rose-500">⚠️ 请至少选择一列进行导出</div>
            ) : previewRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {range === 'selected' ? '当前没有选中任何行' : '范围内没有数据'}
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8 border-r border-slate-200">#</th>
                    {finalCols.map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'px-2 py-1.5 text-left border-r border-slate-200 whitespace-nowrap font-medium text-slate-700',
                          h.startsWith('_') && 'bg-sky-50 text-sky-800'
                        )}
                      >
                        {h}
                        {h.startsWith('_') && <span className="ml-1 text-[9px] text-sky-600">[追踪]</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((r, i) => (
                    <tr key={r._id} className={range === 'selected' ? 'bg-sky-50/40' : 'bg-white'}>
                      <td className="px-2 py-1 border-r border-slate-100 text-slate-400 tabular-nums">
                        {i + 1}
                        {range === 'selected' && <span className="ml-1 text-sky-500">★</span>}
                      </td>
                      {finalCols.map((h) => (
                        <td key={h} className="px-2 py-1 border-r border-slate-100 whitespace-nowrap">
                          {fmt(r.values[h])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {range === 'sample' && previewRows.length > 0 && (
            <div className="px-3 py-1.5 border-t border-teal-100 bg-amber-50/50 text-[11px] text-amber-700">
              🧪 抽样模式（前 {formatNumber(sampleSize)} 行）：实际导出与预览范围一致
            </div>
          )}
          {range === 'selected' && previewRows.length > 0 && (
            <div className="px-3 py-1.5 border-t border-teal-100 bg-sky-50/50 text-[11px] text-sky-700">
              ⭐ 仅导出选中行模式：预览中每行前的 ★ 标记表示选中，顺序与表格中一致
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200">
        <div>
          <div className="text-sm font-semibold text-teal-900">确认导出当前文件处理结果</div>
          <div className="text-xs text-teal-700 mt-0.5">💾 纯本地处理 · 不会上传任何数据到服务器</div>
        </div>
        <div className="flex gap-2">
          {selectedRowIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { clearSelection(); showToast({ type: 'info', message: '已清除行选择' }); }}>
              清除行选择
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={doExport} disabled={finalCols.length === 0 || estimatedRows === 0} leftIcon={<Download size={16} />}>
            下载 {format.toUpperCase()} 文件
          </Button>
        </div>
      </div>

      {/* 保存方案 Modal */}
      {saveModalOpen && (
        <Modal
          open={saveModalOpen}
          title="保存导出方案"
          onClose={() => setSaveModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSaveModalOpen(false)}>取消</Button>
              <Button variant="primary" onClick={handleSaveAsPreset} leftIcon={<Save size={14} />}>保存</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Input label="方案名称" value={newPresetName} onChange={setNewPresetName} placeholder="给这套导出配置起个名字" />
            <div className="text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
              <div>将保存：格式、编码、分隔符、范围、是否带表头/BOM、抽样大小、列选择</div>
              <div>方案会保存到浏览器本地存储，刷新页面仍然存在</div>
            </div>
          </div>
        </Modal>
      )}

      {/* 重命名 Modal */}
      {renameModalOpen && (
        <Modal
          open={renameModalOpen}
          title="重命名方案"
          onClose={() => setRenameModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRenameModalOpen(false)}>取消</Button>
              <Button variant="primary" onClick={confirmRename}>确定</Button>
            </>
          }
        >
          <Input label="新名称" value={renameInput} onChange={setRenameInput} />
        </Modal>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => {
  const map: Record<string, string> = {
    teal: 'from-teal-500 to-teal-600', indigo: 'from-indigo-500 to-indigo-600', amber: 'from-amber-500 to-amber-600',
    emerald: 'from-emerald-500 to-emerald-600', rose: 'from-rose-500 to-rose-600', sky: 'from-sky-500 to-sky-600',
  };
  return (
    <div className="relative rounded-lg border border-white bg-white/80 p-2.5 overflow-hidden shadow-sm">
      <div className={cn('absolute -top-8 -right-8 w-16 h-16 rounded-full bg-gradient-to-br opacity-10', map[color])} />
      <div className="relative flex items-center gap-1.5 text-slate-500">{icon}<span className="text-[10.5px] font-medium">{label}</span></div>
      <div className="relative mt-0.5 text-sm font-bold text-slate-900 tabular-nums break-all">{value}</div>
    </div>
  );
};
