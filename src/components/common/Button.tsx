import React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  block?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white shadow-sm shadow-teal-700/20 border border-teal-700',
  secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-200',
  danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border border-rose-600',
  ghost: 'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-transparent',
  outline: 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1',
  md: 'px-4 py-2 text-sm gap-1.5',
  lg: 'px-6 py-3 text-base gap-2',
  icon: 'p-2 w-9 h-9',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  block,
  className,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        block && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {!loading && leftIcon}
      {children && <span>{children}</span>}
      {rightIcon}
    </button>
  );
};
