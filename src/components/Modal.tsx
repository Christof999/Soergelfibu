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
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    // Sonst scrollt am Handy die Seite hinter dem Formular mit.
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = vorher;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Handy: Blatt von unten über die volle Breite; ab sm: zentriertes Fenster.
  // dvh statt vh: In Safari zählt die ein-/ausfahrende Adressleiste sonst mit und schneidet unten ab.
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`bg-dark-800 border border-dark-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[92dvh] sm:max-h-[90dvh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 pl-4 pr-2 sm:px-6 py-2 sm:py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-gray-100 min-w-0 truncate">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="p-3 sm:p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 px-4 sm:px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
