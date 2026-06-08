import React, { useState } from 'react';
import { useFileStore } from '../../store/useFileStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import type { WorkflowStep, WorkflowTemplate } from '../../engine/types';
import { Button } from '../common/Button';
import { Input, Textarea } from '../common/Form';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { formatDate, formatNumber } from '../../utils/detectType';
import { cn } from '../../lib/utils';
import {
  History,
  Play,
  Trash2,
  Save,
  Upload,
  Download,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  FolderOpen,
  Copy,
  Share2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  GitMerge,
  ArrowLeftRight,
  Wand2,
  Search,
  Target,
  FunctionSquare,
  RefreshCw,
  Download as DownloadIcon,
  FileText,
} from 'lucide-react';

type LucideIcon = React.ComponentType<any>;
const stepIcons: Record<string, LucideIcon> = {
  IMPORT: FileText,
  MARK_NULL: Wand2,
  REMOVE_NULL: Trash2,
  REMOVE_DUPLICATES: Copy,
  REPLACE: Wand2,
  FILTER: Search,
  SPLIT_COLUMN: ArrowLeftRight,
  MERGE_COLUMNS: GitMerge,
  FORMULA_COLUMN: FunctionSquare,
  CONVERT_TYPE: RefreshCw,
  COMPARE: GitMerge,
  EXPORT: DownloadIcon,
};

const stepColors: Record<string, string> = {
  IMPORT: 'text-sky-600 bg-sky-100',
  MARK_NULL: 'text-amber-600 bg-amber-100',
  REMOVE_NULL: 'text-rose-600 bg-rose-100',
  REMOVE_DUPLICATES: 'text-violet-600 bg-violet-100',
  REPLACE: 'text-teal-600 bg-teal-100',
  FILTER: 'text-cyan-600 bg-cyan-100',
  SPLIT_COLUMN: 'text-pink-600 bg-pink-100',
  MERGE_COLUMNS: 'text-indigo-600 bg-indigo-100',
  FORMULA_COLUMN: 'text-orange-600 bg-orange-100',
  CONVERT_TYPE: 'text-lime-600 bg-lime-100',
  COMPARE: 'text-fuchsia-600 bg-fuchsia-100',
  EXPORT: 'text-emerald-600 bg-emerald-100',
};

export const TaskHistory: React.FC<{ isDrawer?: boolean }> = ({ isDrawer = false }) => {
  const { steps, clearSteps, playAll, playStep, removeStep, isPlaying, currentStepIndex, templates, saveTemplate, deleteTemplate, loadTemplate, exportTemplate, importTemplate } =
    useWorkflowStore();
  const { showToast, openModal, closeModal, modal } = useUiStore();
  const { undo, redo, activeFileId } = useFileStore();
  const [tab, setTab] = useState<'steps' | 'templates'>('steps');
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [importJson, setImportJson] = useState('');

  return (
    <div className={cn('flex flex-col h-full', isDrawer ? 'bg-white' : '')}>
      <div className={cn('flex items-center justify-between px-4 py-3 border-b border-slate-200', !isDrawer && 'rounded-t-xl border bg-white')}>
        <div className="flex items-center gap-2">
          <History size={16} className="text-slate-600" />
          <div className="text-sm font-semibold text-slate-800">任务记录 & 工作流</div>
          {isDrawer && (
            <Badge variant="info" size="sm">
              {steps.length} 步骤
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
            onClick={undo}
            title="撤销上一步操作"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 opacity-50"
            onClick={redo}
            title="重做（暂未启用）"
            disabled
          >
            <RotateCcw size={14} className="scale-x-[-1]" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 border-b border-slate-100 bg-white">
        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg w-fit">
          {[
            { id: 'steps', label: '操作步骤', icon: <Clock size={12} />, badge: steps.length },
            { id: 'templates', label: '模板库', icon: <FolderOpen size={12} />, badge: templates.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {t.icon}
              {t.label}
              {t.badge > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    tab === t.id ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-3 space-y-3">
        {tab === 'steps' && (
          <>
            {steps.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Sparkles size={28} className="text-slate-300 mx-auto mb-2" />
                <div>暂无操作步骤</div>
                <div className="mt-1">在清洗、转换等模块操作时，会自动记录步骤</div>
              </div>
            ) : (
              <>
                <ol className="relative border-l-2 border-slate-200 ml-3 space-y-2.5">
                  {steps.map((step, i) => {
                    const Icon = stepIcons[step.type] ?? Sparkles;
                    const active = isPlaying && i === currentStepIndex;
                    const done = isPlaying && i < currentStepIndex;
                    return (
                      <li key={step.id} className="ml-5 relative group">
                        <span
                          className={cn(
                            'absolute -left-[26px] flex items-center justify-center w-6 h-6 rounded-full border-2 border-white shadow-sm',
                            stepColors[step.type] || 'bg-slate-100 text-slate-600',
                            active && 'ring-2 ring-teal-500 animate-pulse',
                            done && 'opacity-60'
                          )}
                        >
                          <Icon size={11} />
                        </span>
                        <div
                          className={cn(
                            'rounded-lg border bg-white p-3 transition',
                            active ? 'border-teal-400 shadow-md shadow-teal-100' : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-400">#{i + 1}</span>
                                <span className="text-xs font-semibold text-slate-800 truncate">{step.label}</span>
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-400 flex items-center gap-1.5">
                                <Clock size={9} />
                                {formatDate(step.timestamp)}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500 font-mono bg-slate-50 rounded p-1.5 overflow-x-auto">
                                {step.type}
                                {Object.keys(step.payload).length > 0 &&
                                  `: ${JSON.stringify(step.payload).slice(0, 80)}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => {
                                  const ok = playStep(step.id);
                                  showToast({ type: ok ? 'success' : 'error', message: ok ? '步骤已执行' : '执行失败' });
                                }}
                                className="p-1 rounded hover:bg-teal-50 text-teal-600"
                                title="单独执行此步骤"
                              >
                                <Play size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  removeStep(step.id);
                                  showToast({ type: 'info', message: '步骤已删除' });
                                }}
                                className="p-1 rounded hover:bg-rose-50 text-rose-500"
                                title="移除此步骤"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Play size={14} />}
                    onClick={async () => {
                      if (!activeFileId) {
                        showToast({ type: 'warning', message: '请先选择要回放的目标文件' });
                        return;
                      }
                      const ok = await playAll();
                      showToast({ type: ok ? 'success' : 'error', message: ok ? '工作流执行完成' : '执行过程中出错' });
                    }}
                    loading={isPlaying}
                  >
                    {isPlaying ? `执行中 ${currentStepIndex + 1}/${steps.length}` : '一键回放全部'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Save size={14} />}
                    onClick={() => {
                      openModal('save-template');
                      setTplName(`我的工作流 ${new Date().toLocaleDateString('zh-CN')}`);
                      setTplDesc(`${steps.length} 个步骤`);
                    }}
                  >
                    保存为模板
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<ChevronUp size={14} />}
                    onClick={() => showToast({ type: 'info', message: `已复制 ${steps.length} 个步骤到剪贴板（模拟）` })}
                  >
                    分享流程 JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearSteps}
                    className="ml-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    leftIcon={<Trash2 size={14} />}
                  >
                    清空记录
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'templates' && (
          <>
            {templates.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <FolderOpen size={28} className="text-slate-300 mx-auto mb-2" />
                <div>暂无工作流模板</div>
                <div className="mt-1">在「操作步骤」中保存常用流程即可反复复用</div>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="rounded-lg border border-slate-200 bg-white p-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                            <Sparkles size={12} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{tpl.name}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <Badge size="sm" variant="info">
                                {tpl.steps.length} 步骤
                              </Badge>
                              <span>已使用 {tpl.usageCount} 次</span>
                              <span>·</span>
                              <span>{formatDate(tpl.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        {tpl.description && <div className="mt-2 text-xs text-slate-500">{tpl.description}</div>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                      <Button
                        size="sm"
                        variant="primary"
                        leftIcon={<Play size={12} />}
                        onClick={() => {
                          loadTemplate(tpl.id);
                          showToast({ type: 'success', message: `已加载模板: ${tpl.name}` });
                          setTab('steps');
                        }}
                      >
                        加载并使用
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Download size={12} />}
                        onClick={() => {
                          const json = exportTemplate(tpl.id);
                          const blob = new Blob([json], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${tpl.name}.csv-workflow.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast({ type: 'success', message: '模板已导出' });
                        }}
                      >
                        导出 JSON
                      </Button>
                      <button
                        onClick={() => {
                          deleteTemplate(tpl.id);
                          showToast({ type: 'info', message: '模板已删除' });
                        }}
                        className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="删除模板"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-1">
              <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Upload size={12} /> 导入模板 (JSON)
                </div>
                <Textarea
                  rows={3}
                  value={importJson}
                  onChange={setImportJson}
                  placeholder="粘贴工作流 JSON 内容..."
                  className="font-mono text-[11px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!importJson.trim()}
                  onClick={() => {
                    const tpl = importTemplate(importJson);
                    if (tpl) {
                      showToast({ type: 'success', message: `成功导入模板: ${tpl.name}` });
                      setImportJson('');
                    } else {
                      showToast({ type: 'error', message: 'JSON 格式无效' });
                    }
                  }}
                  leftIcon={<Upload size={12} />}
                >
                  导入
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={modal?.type === 'save-template'}
        onClose={closeModal}
        size="sm"
        title={
          <div className="flex items-center gap-2">
            <Save size={16} className="text-teal-600" /> 保存工作流模板
          </div>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>取消</Button>
            <Button
              variant="primary"
              leftIcon={<Save size={14} />}
              disabled={!tplName.trim()}
              onClick={() => {
                const tpl = saveTemplate(tplName.trim(), tplDesc.trim());
                showToast({ type: 'success', message: `模板已保存: ${tpl.name}` });
                closeModal();
              }}
            >
              保存
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="模板名称" value={tplName} onChange={setTplName} placeholder="例如：月度销售数据清洗流程" />
          <Textarea label="描述（可选）" rows={2} value={tplDesc} onChange={setTplDesc} placeholder="说明这个工作流的用途..." />
          <div className="text-xs text-slate-500 bg-teal-50 border border-teal-200 rounded-lg p-3">
            包含 <b className="text-teal-700">{steps.length}</b> 个操作步骤，
            下次加载后可一键回放整个流程
          </div>
        </div>
      </Modal>
    </div>
  );
};
