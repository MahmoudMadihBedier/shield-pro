import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';

export interface EntityOption {
  value: string;
  label: string;
  /** small secondary line (phone, code, balance, ...) */
  sub?: string;
}

interface EntitySelectProps {
  options: EntityOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** shows a "＋ إنشاء جديد" row that calls this */
  onCreateNew?: () => void;
  createNewLabel?: string;
  className?: string;
}

// ERPNext "Link field": a searchable picker that always shows a friendly
// label (never an id) and can offer to create a new record inline. Replaces
// the plain <select> lists of customers / suppliers / items / warehouses.
export const EntitySelect: React.FC<EntitySelectProps> = ({
  options, value, onChange, placeholder = 'اختر...', disabled,
  onCreateNew, createNewLabel = 'إنشاء جديد', className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query) || o.sub?.toLowerCase().includes(query));
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border rounded-lg py-2 px-3 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <X
              className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div className="relative p-2 border-b sticky top-0 bg-white">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث..."
              className="w-full border rounded py-1.5 pr-8 pl-2 text-xs"
            />
          </div>
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">لا توجد نتائج</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
              className={`w-full text-right px-3 py-2 text-sm hover:bg-blue-50 ${o.value === value ? 'bg-blue-50/60 font-semibold' : ''}`}
            >
              <div className="text-gray-800">{o.label}</div>
              {o.sub && <div className="text-[11px] text-gray-400">{o.sub}</div>}
            </button>
          ))}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); setQ(''); onCreateNew(); }}
              className="w-full text-right px-3 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 border-t flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> {createNewLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
