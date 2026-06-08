import React, { useState } from 'react';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { exportFile, triggerDownload, type ExportFormat, type ExportRange, type ExportOptions } from '../../engine/exporter';
import { Button } from '../common/Button';
import { Select, Checkbox, Input } from '../common/Form';
import { Badge } from '../common/Badge';
import { formatNumber, formatBytes } from '../../utils/detectType';
import { cn } from '../../lib/utils';
import { Download, FileSpreadsheet, FileText, CheckCircle2, Settings2 } from 'lucide-react';

export const ExportPanel: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile());
  const { selectedRowIds, clearSelection } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [fileName, setFileName] = useState('');
  const [encoding, setEncoding] = useState('UTF-8');
  const [delimiter, setDelimiter] = useState(',');
  const [range, setRange] = useState<ExportRange>('all');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [bom, setBom] = useState(true);
  const [sampleSize, setSampleSize] = useState(100);
  const [cols, setCols] = useState<string[]>(f?.headers ?? []);

  React.useEffect(() => {
    if (f) {
      setCols(f.headers);
      setFileName(f.name.replace(/\.(csv|xlsx)$/i, '') + '_已处理');
    }
  }, [f?.id]);

  if (!f) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-sm text-slate-400">
        请先导入或选择文件以进行导出
      </div>
    );
  }

  const allColsSelected = cols.length === f.headers.length;

  const estimatedRows =
    range === 'all'
      ? f.rowCount
      : range === 'filtered'
      ? f.rowCount
      : range === 'selected'
      ? selectedRowIds.size
      : sampleSize;

  const doExport = () => {
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
      columns: cols,
    };
    try {
      const { blob, fileName: finalName } = exportFile(f, options);
      triggerDownload(blob, finalName);
      addStep({
        type: 'EXPORT',
        payload: { format, fileName: finalName, encoding },
        label: `导出 ${finalName} (${format.toUpperCase()})`,
      });
      showToast({
        type: 'success',
        message: `导出成功：${finalName} (${formatBytes(blob.size)})`,
      });
    } catch (e) {
      showToast({ type: 'error', message: `导出失败: ${(e as Error).message}` });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setFormat('csv')}
          className={cn(
            'rounded-xl border-2 p-5 text-left transition-all',
            format === 'csv'
              ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100'
              : 'border-slate-200 bg-white hover:border-slate-300'
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                format === 'csv' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
              )}
            >
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
            format === 'xlsx'
              ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-100'
              : 'border-slate-200 bg-white hover:border-slate-300'
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                format === 'xlsx' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
              )}
            >
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
          {range === 'sample' && (
            <Input label="抽样行数" type="number" value={String(sampleSize)} onChange={(v) => setSampleSize(Number(v) || 100)} />
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-700">
                导出列（<span className="text-teal-600">{cols.length}</span> / {f.headers.length}）
              </div>
              <div className="flex gap-1.5">
                <button
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  onClick={() => setCols([...f.headers])}
                >
                  全选
                </button>
                <button
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  onClick={() => setCols([])}
                >
                  清空
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded border border-slate-200 max-h-32 overflow-y-auto">
              {f.headers.map((h) => {
                const active = cols.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => setCols(active ? cols.filter((x) => x !== h) : [...cols, h])}
                    className={cn(
                      'px-2 py-0.5 text-[11px] rounded border transition',
                      active
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
                    )}
                  >
                    {active ? '✓ ' : ''}
                    {h}
                  </button>
                );
              })}
            </div>
          </div>
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
              <span className="font-bold text-slate-900 tabular-nums">{formatNumber(cols.length)}</span>
            </div>
            <div className="flex justify-between">
              <span>导出格式</span>
              <Badge variant={format === 'csv' ? 'info' : 'success'} size="sm">
                .{format}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200">
        <div>
          <div className="text-sm font-semibold text-teal-900">确认导出当前文件处理结果</div>
          <div className="text-xs text-teal-700 mt-0.5">
            💾 纯本地处理 · 不会上传任何数据到服务器
          </div>
        </div>
        <div className="flex gap-2">
          {selectedRowIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearSelection();
                showToast({ type: 'info', message: '已清除行选择' });
              }}
            >
              清除行选择
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={doExport}
            disabled={cols.length === 0 || estimatedRows === 0}
            leftIcon={<Download size={16} />}
          >
            下载 {format.toUpperCase()} 文件
          </Button>
        </div>
      </div>
    </div>
  );
};
