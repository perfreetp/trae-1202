import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore';
import { cn } from '../../lib/utils';

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<string, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-sky-50 border-sky-200 text-sky-800',
};

export const Toast: React.FC = () => {
  const { toasts, dismissToast } = useUiStore();
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg shadow-slate-900/5',
              'pointer-events-auto animate-in slide-in-from-right fade-in duration-200',
              colors[t.type]
            )}
          >
            <Icon size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium leading-relaxed">{t.message}</div>
            <button
              onClick={() => dismissToast(t.id)}
              className="flex-shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
