import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// useConfirm()({ title, message, tone:'danger' }) -> Promise<boolean>.
// Replaces window.confirm() and the "no confirmation at all" cases before
// irreversible actions (delete, submit, cancel, post payroll, ...).
export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => settle(false)}
        title={opts?.title}
        size="sm"
        footer={
          <>
            <button
              onClick={() => settle(false)}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {opts?.cancelText || 'إلغاء'}
            </button>
            <button
              onClick={() => settle(true)}
              className={`text-sm font-bold px-4 py-2 rounded-lg text-white ${
                opts?.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {opts?.confirmText || 'تأكيد'}
            </button>
          </>
        }
      >
        {opts?.message && <p className="text-sm text-gray-600 leading-relaxed">{opts.message}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
};
