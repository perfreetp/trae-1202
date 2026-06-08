import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'number' | 'date' | 'string' | 'boolean' | 'mixed';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variants: Record<string, string> = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  number: 'bg-violet-50 text-violet-700 border-violet-200',
  date: 'bg-orange-50 text-orange-700 border-orange-200',
  string: 'bg-teal-50 text-teal-700 border-teal-200',
  boolean: 'bg-pink-50 text-pink-700 border-pink-200',
  mixed: 'bg-slate-100 text-slate-700 border-slate-300',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', size = 'sm', dot, className, children, ...props }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'success' && 'bg-emerald-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'danger' && 'bg-rose-500',
            variant === 'info' && 'bg-sky-500',
            (variant === 'default' || variant === 'mixed') && 'bg-slate-500',
            variant === 'number' && 'bg-violet-500',
            variant === 'date' && 'bg-orange-500',
            variant === 'string' && 'bg-teal-500',
            variant === 'boolean' && 'bg-pink-500'
          )}
        />
      )}
      {children}
    </span>
  );
};
