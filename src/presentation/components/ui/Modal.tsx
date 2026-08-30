import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** max width class, default max-w-lg */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

// One modal for the whole app: backdrop, Esc to close, body scroll lock,
// RTL. Replaces the hand-rolled `fixed inset-0 z-50` overlays.
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          dir="rtl"
        >
          <motion.div
            className={`w-full ${SIZES[size]} bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between border-b px-5 py-3.5 shrink-0">
                <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
                <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="إغلاق">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto p-5 flex-1">{children}</div>
            {footer && <div className="border-t px-5 py-3 flex items-center justify-end gap-2 shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
