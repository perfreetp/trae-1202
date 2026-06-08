import React, { useState } from 'react';
import { Tabs } from '../common/Tabs';
import { Button } from '../common/Button';
import { Input, Select, Checkbox, Textarea } from '../common/Form';
import { Badge } from '../common/Badge';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import * as transformer from '../../engine/transformer';
import type { ColumnType } from '../../engine/types';
import { Scissors, Combine, FunctionSquare, ArrowUpDown, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { formatNumber } from '../../utils/detectType';
import { cn } from '../../lib/utils';

type TabId = 'split' | 'merge' | 'formula' | 'type' | 'manage';

export const TransformPanel: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile());
  const [tab, setTab] = useState<TabId>('split');
  if (!f) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-400 text-sm">
        请先导入或选择文件以进行数据转换
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Tabs
        size="md"
        items={[
          { id: 'split', label: '列拆分', icon: <Scissors size={14} /> },
          { id: 'merge', label: '列合并', icon: <Combine size={14} /> },
          { id: 'formula', label: '公式列', icon: <FunctionSquare size={14} /> },
          { id: 'type', label: '类型转换', icon: <RefreshCw size={14} /> },
          { id: 'manage', label: '列管理', icon: <ArrowUpDown size={14} /> },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />
      {tab === 'split' && <ColumnSplitter />}
      {tab === 'merge' && <ColumnMerger />}
      {tab === 'formula' && <FormulaEditor />}
      {tab === 'type' && <TypeConverter />}
      {tab === 'manage' && <ColumnManager />}
    </div>
  );
};

const ColumnSplitter: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [source, setSource] = useState(f.headers[0] ?? '');
  const [delimiter, setDelimiter] = useState(',');
  const [targets, setTargets] = useState('拆分列1,拆分列2');
  const [keepOriginal, setKeepOriginal] = useState(true);

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select label="源列" value={source} onChange={setSource} options={f.headers.map((h) => ({ label: h, value: h }))} />
        <Input label="分隔符" value={delimiter} onChange={setDelimiter} placeholder=', 或 - 或 | 等' />
        <div className="lg:col-span-2">
          <Input label="目标列名（逗号分隔）" value={targets} onChange={setTargets} placeholder="列A,列B,列C" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox checked={keepOriginal} onChange={setKeepOriginal} label="保留原始列（关闭则删除源列）" />
        <Button
          variant="primary"
          onClick={() => {
            const ts = targets.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
            if (!source || ts.length === 0 || !delimiter) {
              showToast({ type: 'warning', message: '请填写完整参数' });
              return;
            }
            updateActiveFile((file) => transformer.splitColumn(file, source, delimiter, ts, keepOriginal), true);
            addStep({ type: 'SPLIT_COLUMN', payload: { source, delimiter, targets: ts }, label: `拆分 ${source} → ${ts.join(',')}` });
            showToast({ type: 'success', message: '拆分完成' });
          }}
          leftIcon={<Scissors size={14} />}
        >
          执行拆分
        </Button>
      </div>
      <div className="text-xs text-slate-500 bg-sky-50 border border-sky-200 rounded-lg p-3">
        示例：姓名列 "张三-经理"，分隔符 "-"，目标 "姓名,职位"，拆分为两列
      </div>
    </div>
  );
};

const ColumnMerger: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [sources, setSources] = useState<string[]>(f.headers.slice(0, 2));
  const [separator, setSeparator] = useState(' ');
  const [target, setTarget] = useState('合并列');
  const [keepOriginal, setKeepOriginal] = useState(true);

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-700">选择要合并的列（点击切换）</div>
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
          {f.headers.map((h) => {
            const active = sources.includes(h);
            return (
              <button
                key={h}
                onClick={() => setSources(active ? sources.filter((x) => x !== h) : [...sources, h])}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition',
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input label="合并后列名" value={target} onChange={setTarget} placeholder="例如：完整地址" />
        <Input label="连接符" value={separator} onChange={setSeparator} placeholder="空格 / - / , / 无" />
        <div className="flex items-end gap-2">
          <Checkbox checked={keepOriginal} onChange={setKeepOriginal} label="保留源列" />
        </div>
      </div>
      <Button
        variant="primary"
        disabled={sources.length < 2}
        onClick={() => {
          updateActiveFile((file) => transformer.mergeColumns(file, sources, target, separator, keepOriginal), true);
          addStep({ type: 'MERGE_COLUMNS', payload: { sources, target, separator, keepOriginal }, label: `合并 ${sources.join('+')} → ${target}` });
          showToast({ type: 'success', message: '合并完成' });
        }}
        leftIcon={<Combine size={14} />}
      >
        合并 {sources.length} 列 → {target}
      </Button>
    </div>
  );
};

const FormulaEditor: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [target, setTarget] = useState('计算列');
  const [expression, setExpression] = useState('[工资] * 1.1');
  const [preview, setPreview] = useState<{ ok: boolean; sample: { row: number; value: string | number | null }[]; error?: string } | null>(null);

  const testExpr = () => {
    try {
      const { errors } = transformer.addFormulaColumn({ ...f, rows: f.rows.slice(0, 10) }, target, expression);
      if (errors.length > 0 && errors[0].rowIndex === -1) {
        setPreview({ ok: false, sample: [], error: errors[0].message });
        return;
      }
      const { file: sample } = transformer.addFormulaColumn({ ...f, rows: f.rows.slice(0, 5) }, target, expression);
      setPreview({
        ok: true,
        sample: sample.rows.map((r, i) => ({ row: i + 1, value: r.values[target] ?? null })),
      });
    } catch (e) {
      setPreview({ ok: false, sample: [], error: (e as Error).message });
    }
  };

  const examples = [
    { label: '两列相加', expr: '[价格] * [数量]' },
    { label: '条件计算', expr: 'if([年龄] >= 35, [工资] * 1.2, [工资] * 1.1)' },
    { label: '百分比', expr: 'round([销售额] / [总额] * 100, 2)' },
    { label: '日期差', expr: '([入职天数] / 365)' },
  ];

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Input label="新列名" value={target} onChange={setTarget} placeholder="计算结果列名称" />
        <div className="md:col-span-3">
          <Textarea
            label={`公式表达式（使用 [列名] 引用列）`}
            value={expression}
            onChange={setExpression}
            rows={2}
            placeholder="例如: [数量] * [单价] * (1 + [税率])"
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-700">常用公式示例：</div>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setExpression(ex.expr)}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition"
            >
              {ex.label}: <code className="ml-1 opacity-70">{ex.expr}</code>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-700">可引用的列：</div>
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
          {f.headers.map((h) => (
            <button
              key={h}
              onClick={() => setExpression((e) => e + `[${h}]`)}
              className="px-2 py-0.5 text-[11px] bg-white border border-slate-200 rounded hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition font-mono"
            >
              [{h}]
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={testExpr} leftIcon={<FunctionSquare size={14} />}>
          预览前 5 行
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const { file, errors } = transformer.addFormulaColumn(f, target, expression);
            updateActiveFile(() => file, true);
            addStep({ type: 'FORMULA_COLUMN', payload: { target, expression }, label: `公式列 ${target} = ${expression}` });
            const ok = formatNumber(f.rowCount - errors.length);
            showToast({
              type: errors.length > 0 ? 'warning' : 'success',
              message: `生成完成：${ok} 行成功${errors.length > 0 ? `，${errors.length} 行计算异常` : ''}`,
            });
          }}
          leftIcon={<FunctionSquare size={14} />}
        >
          生成公式列
        </Button>
      </div>
      {preview && (
        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
          <div className="text-xs font-medium text-slate-700 mb-2">
            预览结果：
            {preview.ok ? <Badge variant="success" size="sm">OK</Badge> : <Badge variant="danger" size="sm">错误</Badge>}
          </div>
          {preview.error && <div className="text-xs text-rose-600 mb-2 font-mono">{preview.error}</div>}
          {preview.ok && (
            <div className="grid grid-cols-5 gap-1.5">
              {preview.sample.map((r) => (
                <div key={r.row} className="rounded bg-white border border-slate-200 p-2 text-[11px]">
                  <div className="text-slate-400">第 {r.row} 行</div>
                  <div className="font-mono text-slate-800 mt-0.5">
                    {r.value === null ? <span className="text-slate-400 italic">空</span> : String(r.value)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="text-xs text-slate-500 bg-sky-50 border border-sky-200 rounded-lg p-3">
        🔢 支持运算符：+ - * / % ^ 以及函数 round/abs/floor/ceil/min/max/if/sqrt/log/pow/sin/cos/tan；不支持字符串操作
      </div>
    </div>
  );
};

const TypeConverter: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile } = useFileStore();
  const { showToast } = useUiStore();
  const addStep = useWorkflowStore((s) => s.addStep);
  const [column, setColumn] = useState(f.headers[0] ?? '');
  const [toType, setToType] = useState<ColumnType>('string');
  const [format, setFormat] = useState('YYYY-MM-DD');
  const cur = f.columns.find((c) => c.name === column);

  const typeOpts: { label: string; value: ColumnType }[] = [
    { label: '文本 (String)', value: 'string' },
    { label: '数字 (Number)', value: 'number' },
    { label: '日期 (Date)', value: 'date' },
    { label: '布尔 (Boolean)', value: 'boolean' },
  ];

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Select label="目标列" value={column} onChange={setColumn} options={f.headers.map((h) => ({ label: h, value: h }))} />
        <Select
          label="转换为"
          value={toType}
          onChange={(v) => setToType(v as ColumnType)}
          options={typeOpts}
        />
        {toType === 'date' && <Input label="日期格式" value={format} onChange={setFormat} placeholder="YYYY-MM-DD HH:mm:ss" />}
      </div>
      {cur && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>当前类型：</span>
          <Badge variant={cur.type as any} dot size="sm">
            {cur.type} {cur.inferred ? '（推断）' : ''}
          </Badge>
          <span className="text-slate-400 mx-2">→</span>
          <Badge variant={toType as any} dot size="sm">
            {toType}
          </Badge>
        </div>
      )}
      <Button
        variant="primary"
        onClick={() => {
          updateActiveFile((file) => transformer.convertType(file, column, toType, format), true);
          addStep({ type: 'CONVERT_TYPE', payload: { column, toType, format }, label: `${column} 类型 → ${toType}` });
          showToast({ type: 'success', message: '类型转换完成' });
        }}
        leftIcon={<RefreshCw size={14} />}
      >
        执行转换
      </Button>
      <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
        转换失败的值会被置为空；数字识别会自动去除千分位逗号
      </div>
    </div>
  );
};

const ColumnManager: React.FC = () => {
  const f = useFileStore((s) => s.getActiveFile())!;
  const { updateActiveFile, setSelectedColumn, selectedColumn } = useFileStore();
  const { showToast } = useUiStore();
  const [renameFrom, setRenameFrom] = useState(selectedColumn ?? f.headers[0] ?? '');
  const [renameTo, setRenameTo] = useState('');
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([...f.headers]);

  React.useEffect(() => {
    setOrder([...f.headers]);
  }, [f.headers.join('|')]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
            <Edit3 size={14} /> 列重命名
          </div>
          <div className="space-y-2">
            <Select value={renameFrom} onChange={setRenameFrom} options={f.headers.map((h) => ({ label: h, value: h }))} />
            <Input placeholder="新列名" value={renameTo} onChange={setRenameTo} />
            <Button
              size="sm"
              variant="outline"
              disabled={!renameFrom || !renameTo}
              onClick={() => {
                if (f.headers.includes(renameTo)) {
                  showToast({ type: 'error', message: '列名已存在' });
                  return;
                }
                updateActiveFile((file) => transformer.renameColumn(file, renameFrom, renameTo), true);
                showToast({ type: 'success', message: `已重命名: ${renameFrom} → ${renameTo}` });
                setRenameTo('');
              }}
              leftIcon={<Edit3 size={12} />}
            >
              重命名
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
            <Trash2 size={14} /> 删除列
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded border border-slate-200">
              {f.headers.map((h) => {
                const active = toDelete.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => setToDelete(active ? toDelete.filter((x) => x !== h) : [...toDelete, h])}
                    className={cn(
                      'px-2 py-0.5 text-[11px] rounded border transition',
                      active
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400'
                    )}
                  >
                    {active ? '✗ ' : ''}
                    {h}
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="danger"
              disabled={toDelete.length === 0}
              onClick={() => {
                updateActiveFile((file) => transformer.deleteColumns(file, toDelete), true);
                showToast({ type: 'success', message: `删除了 ${toDelete.length} 列` });
                setToDelete([]);
              }}
              leftIcon={<Trash2 size={12} />}
            >
              删除 {toDelete.length} 列
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
          <ArrowUpDown size={14} /> 列顺序调整
        </div>
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded border border-slate-200">
          {order.map((h, idx) => (
            <div
              key={h + idx}
              className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-slate-200"
            >
              <span className="text-[11px] text-slate-400 w-4">{idx + 1}</span>
              <span className="text-xs text-slate-700">{h}</span>
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="px-1 text-slate-400 hover:text-teal-600 disabled:opacity-30"
              >
                ←
              </button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === order.length - 1}
                className="px-1 text-slate-400 hover:text-teal-600 disabled:opacity-30"
              >
                →
              </button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={order.join('|') === f.headers.join('|')}
          onClick={() => {
            updateActiveFile((file) => transformer.reorderColumns(file, order), true);
            showToast({ type: 'success', message: '列顺序已更新' });
          }}
          leftIcon={<ArrowUpDown size={12} />}
        >
          应用新顺序
        </Button>
      </div>
    </div>
  );
};
