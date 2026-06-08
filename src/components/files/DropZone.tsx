import React, { useCallback, useRef } from 'react';
import { Upload, FileText, AlertCircle, Plus, X, FileInput } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { parseFile, detectEncoding, parseCsvText } from '../../engine/parser';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Select, Input, Checkbox } from '../common/Form';
import { formatBytes, formatDate, formatNumber } from '../../utils/detectType';

export const DropZone: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);
  const [encoding, setEncoding] = React.useState('AUTO');
  const [delimiter, setDelimiter] = React.useState('AUTO');
  const [hasHeader, setHasHeader] = React.useState(true);
  const { addFile, files } = useFileStore();
  const { showToast, setActiveModule } = useUiStore();

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const items = Array.from(fileList).filter((f) =>
        /\.(csv|tsv|txt|dat)$/i.test(f.name) || f.type.includes('csv') || f.type.includes('text')
      );
      if (items.length === 0) {
        showToast({ type: 'warning', message: '请选择 CSV / TSV 等文本格式文件' });
        return;
      }

      let success = 0;
      for (const file of items) {
        try {
          let finalEncoding = encoding;
          if (encoding === 'AUTO') {
            const buffer = await file.arrayBuffer();
            finalEncoding = detectEncoding(buffer);
          }
          const result = await parseFile(file, {
            encoding: finalEncoding,
            delimiter: delimiter === 'AUTO' ? undefined : delimiter,
            hasHeader,
          });
          addFile(result.file);
          success++;
        } catch (e) {
          showToast({ type: 'error', message: `解析失败: ${file.name} - ${(e as Error).message}` });
        }
      }
      if (success > 0) {
        showToast({ type: 'success', message: `成功导入 ${success} 个文件` });
        if (success === 1) setActiveModule('preview');
      }
    },
    [addFile, encoding, delimiter, hasHeader, showToast, setActiveModule]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const pasteSampleData = () => {
    const sampleText = `姓名,年龄,部门,工资,入职日期
张三,28,技术部,15000,2021-03-15
李四,32,市场部,18500,2019-07-01
王五,25,人事部,12000,2022-01-10
赵六,,财务部,,2020-11-20
钱七,35,技术部,22000,2018-05-08
孙八,29,市场部,16500,2021-09-22
周九,28,技术部,15000,2021-03-15
吴十,31,产品部,19800,2020-02-14
郑十一,27,,14200,2022-06-30
冯十二,33,财务部,21000,2019-12-01
陈十三,26,技术部,13500,2023-02-28
褚十四,30,市场部,,2020-08-15`;
    try {
      const result = parseCsvText(sampleText, '示例数据.csv', sampleText.length, {
        encoding: 'UTF-8',
      });
      addFile(result.file);
      showToast({ type: 'success', message: '示例数据已导入' });
      setActiveModule('preview');
    } catch (e) {
      showToast({ type: 'error', message: '示例数据导入失败' });
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200',
          'flex flex-col items-center justify-center gap-3 py-14 px-6 text-center select-none',
          'group',
          isDragging
            ? 'border-teal-500 bg-teal-50/50 scale-[1.005] shadow-lg shadow-teal-200/50'
            : 'border-slate-300 bg-slate-50/50 hover:border-teal-400 hover:bg-teal-50/30'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.tsv,.txt,.dat,text/csv,text/plain"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center transition-all',
            isDragging
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 scale-110'
              : 'bg-white text-teal-600 border border-teal-100 group-hover:scale-105'
          )}
        >
          {isDragging ? <FileInput size={30} /> : <Upload size={30} />}
        </div>
        <div>
          <div className="text-base font-semibold text-slate-800">
            {isDragging ? '松开导入文件' : '拖拽文件到此处'}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            或<span className="text-teal-600 font-medium mx-1">点击选择</span>CSV / TSV / TXT 文件，支持多选
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
          <span className="px-2 py-0.5 rounded bg-slate-200/60">.csv</span>
          <span className="px-2 py-0.5 rounded bg-slate-200/60">.tsv</span>
          <span>最大 100MB · 纯本地处理</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowOptions((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-teal-600 transition font-medium"
          >
            <span>解析选项</span>
            <span className={cn('transition-transform', showOptions && 'rotate-180')}>▾</span>
          </button>
          <Button variant="ghost" size="sm" onClick={pasteSampleData} leftIcon={<Plus size={14} />}>
            加载示例数据
          </Button>
        </div>
        {files.length > 0 && <Badge variant="info">已导入 {files.length} 个文件</Badge>}
      </div>

      {showOptions && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <Select
            label="字符编码"
            value={encoding}
            onChange={setEncoding}
            options={[
              { label: '自动识别', value: 'AUTO' },
              { label: 'UTF-8', value: 'UTF-8' },
              { label: 'UTF-8 BOM', value: 'UTF-8' },
              { label: 'GBK / GB2312', value: 'GBK' },
              { label: 'GB18030', value: 'GB18030' },
              { label: 'Big5', value: 'Big5' },
              { label: 'Shift-JIS', value: 'Shift_JIS' },
            ]}
          />
          <Select
            label="列分隔符"
            value={delimiter}
            onChange={setDelimiter}
            options={[
              { label: '自动识别', value: 'AUTO' },
              { label: '逗号 ,', value: ',' },
              { label: '制表符 Tab', value: '\t' },
              { label: '分号 ;', value: ';' },
              { label: '竖线 |', value: '|' },
              { label: '冒号 :', value: ':' },
            ]}
          />
          <div className="md:col-span-2 flex items-end">
            <Checkbox checked={hasHeader} onChange={setHasHeader} label="首行作为列名（取消则自动命名为 列1/列2…）" />
          </div>
        </div>
      )}
    </div>
  );
};

export const FileList: React.FC = () => {
  const { files, activeFileId, setActiveFile, removeFile } = useFileStore();
  const { showToast } = useUiStore();

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
        <AlertCircle size={32} className="text-slate-300" />
        <div>
          <div className="text-sm font-medium text-slate-500">暂无文件</div>
          <div className="text-xs text-slate-400 mt-1">请在上方导入 CSV 文件开始处理</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {files.map((f) => {
        const active = f.id === activeFileId;
        return (
          <div
            key={f.id}
            onClick={() => setActiveFile(f.id)}
            className={cn(
              'group relative rounded-xl border p-4 cursor-pointer transition-all duration-150',
              'bg-white hover:shadow-md',
              active
                ? 'border-teal-400 ring-2 ring-teal-100 shadow-md shadow-teal-100/50'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            {active && (
              <div className="absolute -top-1.5 -right-1.5">
                <Badge variant="success">当前</Badge>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  active ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'
                )}
              >
                <FileText size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate" title={f.name}>
                  {f.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  <span>{formatNumber(f.rowCount)} 行</span>
                  <span>{f.headers.length} 列</span>
                  <span>{formatBytes(f.size)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge size="sm" variant="info">
                    {f.encoding}
                  </Badge>
                  <Badge size="sm" variant="default">
                    分隔符 {f.delimiter === '\t' ? 'Tab' : f.delimiter === ',' ? ',' : JSON.stringify(f.delimiter)}
                  </Badge>
                  {f.meta.nullCount > 0 && (
                    <Badge size="sm" variant="warning">
                      空值 {formatNumber(f.meta.nullCount)}
                    </Badge>
                  )}
                  {f.meta.duplicateCount > 0 && (
                    <Badge size="sm" variant="danger">
                      重复 {formatNumber(f.meta.duplicateCount)}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-400">{formatDate(f.importedAt)}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(f.id);
                  showToast({ type: 'info', message: `已移除文件: ${f.name}` });
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                title="移除此文件"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
