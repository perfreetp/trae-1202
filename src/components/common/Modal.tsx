import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = 'md', className }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative bg-white rounded-xl shadow-2xl border border-slate-200',
          'w-full',
          sizeMap[size],
          'max-h-[90vh] flex flex-col',
          'animate-in zoom-in-95 slide-in-from-bottom-4 duration-200',
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
};
