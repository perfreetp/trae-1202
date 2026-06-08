import React from 'react';
import {
  FolderOpen,
  Table2,
  Sparkles,
  ArrowLeftRight,
  GitCompare,
  Download,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ModuleId } from '../../engine/types';
import { useUiStore } from '../../store/useUiStore';
import { cn } from '../../lib/utils';

type LucideIcon = React.ComponentType<any>;
const modules: { id: ModuleId; icon: LucideIcon; label: string; color: string }[] = [
  { id: 'files', icon: FolderOpen, label: '文件区', color: 'text-sky-600' },
  { id: 'preview', icon: Table2, label: '预览区', color: 'text-teal-600' },
  { id: 'clean', icon: Sparkles, label: '清洗区', color: 'text-amber-600' },
  { id: 'transform', icon: ArrowLeftRight, label: '转换区', color: 'text-violet-600' },
  { id: 'compare', icon: GitCompare, label: '比对区', color: 'text-rose-600' },
  { id: 'export', icon: Download, label: '导出区', color: 'text-emerald-600' },
  { id: 'history', icon: History, label: '任务记录', color: 'text-slate-600' },
];

export const Sidebar: React.FC = () => {
  const { activeModule, setActiveModule, sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        'relative h-full flex flex-col bg-white border-r border-slate-200',
        'transition-[width] duration-200 ease-out',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-100 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-sm shadow-teal-700/30 flex-shrink-0">
          <Table2 size={18} className="text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">CSV 工作台</div>
            <div className="text-[10px] text-slate-400">本地处理 · 零上传</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {modules.map((m) => {
          const Icon = m.icon;
          const active = activeModule === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 group',
                sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                active
                  ? 'bg-teal-50 text-teal-700 shadow-inner ring-1 ring-teal-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
              title={sidebarCollapsed ? m.label : undefined}
            >
              <Icon
                size={18}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  active ? m.color : 'text-slate-400 group-hover:text-slate-600'
                )}
              />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{m.label}</span>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-slate-100 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition',
            sidebarCollapsed && 'justify-center px-0'
          )}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!sidebarCollapsed && <span>收起导航</span>}
        </button>
      </div>
    </aside>
  );
};
