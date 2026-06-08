import React from 'react';
import { cn } from '../../lib/utils';

interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number | string;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const Tabs: React.FC<TabsProps> = ({ items, activeId, onChange, className, size = 'md' }) => {
  return (
    <div
      className={cn(
        'inline-flex bg-slate-100 rounded-lg p-1 gap-0.5',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
    >
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => !item.disabled && onChange(item.id)}
            disabled={item.disabled}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-all duration-150',
              size === 'sm' ? 'px-2.5 py-1' : 'px-3.5 py-1.5',
              active
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50',
              item.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                  active ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
