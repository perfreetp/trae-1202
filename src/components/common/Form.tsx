import React from 'react';
import { cn } from '../../lib/utils';

export interface SelectOption<V = string> {
  label: string;
  value: V;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  label?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  error,
  label,
  className,
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'w-full px-3 py-2 text-sm bg-white border rounded-lg transition',
          'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
          error ? 'border-rose-400' : 'border-slate-300 hover:border-slate-400',
          'appearance-none bg-no-repeat bg-[right_0.75rem_center] pr-8',
          className
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3e%3cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3e%3c/svg%3e\")",
          backgroundSize: '1.1rem',
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string | number;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  label,
  error,
  leftIcon,
  rightIcon,
  className,
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">{leftIcon}</div>}
        <input
          id={inputId}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'w-full px-3 py-2 text-sm bg-white border rounded-lg transition',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
            error ? 'border-rose-400' : 'border-slate-300 hover:border-slate-400',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            className
          )}
          {...props}
        />
        {rightIcon && <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">{rightIcon}</div>}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};

interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ value, onChange, label, error, className, ...props }) => {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-slate-700">{label}</label>}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'w-full px-3 py-2 text-sm bg-white border rounded-lg transition resize-y',
          'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
          error ? 'border-rose-400' : 'border-slate-300 hover:border-slate-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, className, id, ...props }) => {
  const inputId = id || `cb-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <label htmlFor={inputId} className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-500"
        {...props}
      />
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
};
