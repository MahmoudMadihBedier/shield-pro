import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface DocColumn<T> {
  key: string;
  label: string;
  /** custom cell; defaults to String(row[key]) */
  render?: (row: T) => React.ReactNode;
  /** shown as the bold title of the card on mobile */
  primary?: boolean;
  className?: string;
  /** hide this column on mobile card layout */
  hideOnCard?: boolean;
}

interface DocListProps<T> {
  rows: T[];
  columns: DocColumn<T>[];
  getId: (row: T) => string;
  onOpen?: (row: T) => void;
  onNew?: () => void;
  newLabel?: string;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  /** enable the search box; return true if the row matches the query */
  search?: (row: T, q: string) => boolean;
  /** extra filter controls rendered in the toolbar (status chips, etc.) */
  toolbar?: React.ReactNode;
}

// ERPNext-style List view: toolbar (search + «جديد» + count), a table on
// desktop, stacked cards on mobile, and a helpful empty state. Rows are
// supplied already-loaded by the caller (the app loads from Dexie into
// component state); this component is presentational.
export function DocList<T>({
  rows, columns, getId, onOpen, onNew, newLabel = 'جديد',
  loading, emptyTitle = 'لا توجد سجلات', emptyHint, search, toolbar,
}: DocListProps<T>) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!search || !q.trim()) return rows;
    const query = q.trim();
    return rows.filter((r) => search(r, query));
  }, [rows, q, search]);

  return (
    <div className="bg-white rounded-lg border shadow-sm" dir="rtl">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b">
        {search && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث..."
              className="w-full border rounded-lg py-2 pr-9 pl-3 text-sm"
            />
          </div>
        )}
        {toolbar}
        <span className="text-xs text-gray-400 mr-auto">{filtered.length} سجل</span>
        {onNew && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> {newLabel}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-400 py-10">جاري التحميل...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          hint={emptyHint}
          action={onNew ? { label: newLabel, onClick: onNew } : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm text-right">
              <thead className="text-xs font-bold text-gray-500 border-b bg-gray-50">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={`py-2.5 px-3 ${c.className || ''}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr
                    key={getId(row)}
                    onClick={() => onOpen?.(row)}
                    className={`${onOpen ? 'cursor-pointer hover:bg-blue-50/40' : ''}`}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={`py-2.5 px-3 ${c.className || ''}`}>
                        {c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((row) => (
              <button
                key={getId(row)}
                onClick={() => onOpen?.(row)}
                className="w-full text-right p-3 hover:bg-blue-50/40 block"
              >
                {columns.filter((c) => !c.hideOnCard).map((c, i) => {
                  const content = c.render ? c.render(row) : String((row as any)[c.key] ?? '—');
                  return c.primary ? (
                    <div key={c.key} className="font-bold text-gray-800 mb-1">{content}</div>
                  ) : (
                    <div key={c.key} className={`text-xs text-gray-500 flex justify-between gap-2 ${i ? 'mt-0.5' : ''}`}>
                      <span className="text-gray-400">{c.label}</span>
                      <span className="text-gray-700">{content}</span>
                    </div>
                  );
                })}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
