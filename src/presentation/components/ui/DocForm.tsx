import React from 'react';
import { StatusBadge } from './StatusBadge';
import { formatDateTime } from '../../../shared/utils/format';

interface Connection {
  label: string;
  count?: number;
  onClick?: () => void;
}
interface TimelineEntry {
  text: string;
  at?: string;
  by?: string;
}
interface MetaRow {
  label: string;
  value: React.ReactNode;
}

interface DocFormProps {
  title: string;
  status?: { group: string; value: string | null | undefined };
  meta?: MetaRow[];
  timeline?: TimelineEntry[];
  connections?: Connection[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

// ERPNext-style Form view: a main column of sections + a right sidebar
// (status, meta, activity timeline, linked-document "connections") + a
// sticky action bar. Composed with <DocForm.Section> for field groups.
export const DocForm: React.FC<DocFormProps> & { Section: typeof Section } = ({
  title, status, meta, timeline, connections, actions, children,
}) => (
  <div dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {status && <StatusBadge group={status.group} value={status.value} />}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-5 min-w-0">{children}</div>

      <aside className="space-y-4">
        {meta && meta.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm p-4 text-xs space-y-2">
            {meta.map((m, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-gray-400">{m.label}</span>
                <span className="text-gray-700 font-medium text-left">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {connections && connections.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 mb-2">مستندات مرتبطة</p>
            <div className="space-y-1">
              {connections.map((c, i) => (
                <button
                  key={i}
                  onClick={c.onClick}
                  disabled={!c.onClick}
                  className="w-full flex justify-between items-center text-xs px-2 py-1.5 rounded hover:bg-gray-50 disabled:hover:bg-transparent text-right"
                >
                  <span className="text-gray-700">{c.label}</span>
                  {c.count != null && (
                    <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 text-[10px] font-bold">{c.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {timeline && timeline.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 mb-2">النشاط</p>
            <ol className="space-y-2">
              {timeline.map((t, i) => (
                <li key={i} className="text-[11px] text-gray-600 border-r-2 border-gray-200 pr-2">
                  <div>{t.text}</div>
                  <div className="text-gray-400">
                    {t.by ? `${t.by} · ` : ''}{t.at ? formatDateTime(t.at) : ''}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>

    {actions && (
      <div className="sticky bottom-0 mt-6 bg-white/90 backdrop-blur border-t -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2">
        {actions}
      </div>
    )}
  </div>
);

const Section: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({
  title, children, className = '',
}) => (
  <section className={`bg-white rounded-lg border shadow-sm p-4 sm:p-5 ${className}`}>
    {title && <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-4">{title}</h3>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </section>
);

DocForm.Section = Section;
