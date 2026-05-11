import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-black/60 backdrop-blur-sm">
      <div
        className={`bg-dark-800 border border-dark-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[min(92dvh,100vh)] sm:max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-dark-700 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-100 pr-2 break-words">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-700 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>
  );
}
