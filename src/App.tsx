import React, { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TaskHistory } from './components/layout/TaskHistory';
import { DropZone, FileList } from './components/files/DropZone';
import { DataTable, StatsPanel, ColumnTypeBadge } from './components/preview/DataTable';
import { CleanPanel } from './components/clean/CleanPanel';
import { TransformPanel } from './components/transform/TransformPanel';
import { ComparePanel } from './components/compare/ComparePanel';
import { ExportPanel } from './components/export/ExportPanel';
import { Toast } from './components/common/Toast';
import { Badge } from './components/common/Badge';
import { Button } from './components/common/Button';
import { useUiStore } from './store/useUiStore';
import { useFileStore } from './store/useFileStore';
import { cn } from './lib/utils';
import { FolderOpen, Table2, Sparkles, ArrowLeftRight, GitCompare, Download, History, ChevronUp, ChevronDown, FileText, Undo2, Redo2, Database } from 'lucide-react';

type LucideIcon = React.ComponentType<any>;
const moduleConfig: Record<string, { title: string; subtitle: string; icon: LucideIcon; accent: string }> = {
  files: { title: '文件区', subtitle: '导入、管理、配置 CSV 文件', icon: FolderOpen, accent: 'from-sky-500 to-sky-600' },
  preview: { title: '预览区', subtitle: '数据抽样、概览统计、快速浏览', icon: Table2, accent: 'from-teal-500 to-teal-600' },
  clean: { title: '清洗区', subtitle: '空值、去重、替换、筛选、错误定位', icon: Sparkles, accent: 'from-amber-500 to-amber-600' },
  transform: { title: '转换区', subtitle: '列拆分合并、公式计算、类型转换', icon: ArrowLeftRight, accent: 'from-violet-500 to-violet-600' },
  compare: { title: '比对区', subtitle: '两表关联、差异高亮、合并输出', icon: GitCompare, accent: 'from-rose-500 to-rose-600' },
  export: { title: '导出区', subtitle: 'CSV / Excel 格式输出下载', icon: Download, accent: 'from-emerald-500 to-emerald-600' },
  history: { title: '任务记录', subtitle: '操作时间线、工作流模板、一键复用', icon: History, accent: 'from-slate-500 to-slate-600' },
};

export default function App() {
  const { activeModule, sidebarCollapsed, historyDrawerOpen, setHistoryDrawerOpen, setActiveModule } = useUiStore();
  const { files, activeFileId, getActiveFile, undo, redo, selectedRowIds } = useFileStore();
  const f = getActiveFile();
  const Icon = moduleConfig[activeModule]?.icon ?? FolderOpen;
  const cfg = moduleConfig[activeModule];

  const renderModule = () => {
    switch (activeModule) {
      case 'files':
        return (
          <div className="space-y-5">
            <DropZone />
            <section>
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-slate-500" /> 已导入文件
              </h3>
              <FileList />
            </section>
          </div>
        );
      case 'preview':
        return (
          <div className="space-y-4">
            <StatsPanel />
            <DataTable />
            {f && (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Database size={16} className="text-slate-500" /> 列类型概览 ({f.columns.length} 列)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {f.columns.map((c) => (
                    <div key={c.name} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 hover:bg-white transition">
                      <div className="text-xs font-semibold text-slate-800 truncate" title={c.name}>{c.name}</div>
                      <div className="mt-1"><ColumnTypeBadge column={c} /></div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>空值 {c.nullCount}</span>
                        <span>唯一 {c.uniqueCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      case 'clean':
        return <CleanPanel />;
      case 'transform':
        return <TransformPanel />;
      case 'compare':
        return <ComparePanel />;
      case 'export':
        return <ExportPanel />;
      case 'history':
        return (
          <div className="rounded-xl border border-slate-200 bg-white min-h-[560px] overflow-hidden">
            <TaskHistory />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden">
      <header className="h-12 flex-shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Badge variant="info" size="sm">
              {files.length} 文件
            </Badge>
            {f && (
              <>
                <span className="text-slate-300">|</span>
                <span className="font-medium text-slate-700 truncate max-w-[260px]">{f.name}</span>
                <Badge variant="default" size="sm">
                  {f.rowCount} 行 × {f.headers.length} 列
                </Badge>
              </>
            )}
            {selectedRowIds.size > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <Badge variant="warning" size="sm">
                  已选 {selectedRowIds.size} 行
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={undo} leftIcon={<Undo2 size={14} />}>
            撤销
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} leftIcon={<Redo2 size={14} />} disabled>
            重做
          </Button>
          <span className="w-px h-6 bg-slate-200 mx-1" />
          <div className="flex flex-wrap gap-1">
            {(['files', 'preview', 'clean', 'transform', 'compare', 'export'] as const).map((id) => {
              const active = activeModule === id;
              const CfgIcon = moduleConfig[id].icon;
              return (
                <button
                  key={id}
                  onClick={() => setActiveModule(id)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition',
                    active
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <CfgIcon size={13} />
                  <span className="hidden sm:inline">{moduleConfig[id].title.replace('区', '')}</span>
                </button>
              );
            })}
          </div>
          <span className="w-px h-6 bg-slate-200 mx-1" />
          <button
            onClick={() => setHistoryDrawerOpen(!historyDrawerOpen)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition',
              historyDrawerOpen
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <History size={13} />
            <span className="hidden sm:inline">工作流</span>
            {historyDrawerOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-6 pt-5 pb-3 bg-gradient-to-b from-white to-transparent">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-md', cfg.accent)}>
                  <Icon size={20} />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">{cfg.title}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">{cfg.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Badge variant="success" dot size="sm">
                  本地处理
                </Badge>
                <span>零上传 · 零安装</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-48">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {renderModule()}
            </div>
          </div>
        </main>
      </div>

      {historyDrawerOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 h-[45vh] border-t border-slate-300 bg-white shadow-2xl shadow-slate-900/10 animate-in slide-in-from-bottom duration-300">
          <TaskHistory isDrawer />
        </div>
      )}

      <Toast />
    </div>
  );
}
