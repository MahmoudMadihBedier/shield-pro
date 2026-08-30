import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabDef {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

// One tab bar for the whole app: wraps on mobile, scrolls if still too wide,
// accessible. Replaces ~10 hand-rolled `flex border-b` button rows.
export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => (
  <div
    role="tablist"
    className="flex flex-wrap gap-1 border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm overflow-x-auto"
  >
    {tabs.map(({ key, label, icon: Icon, badge }) => (
      <button
        key={key}
        role="tab"
        aria-selected={active === key}
        onClick={() => onChange(key)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
          active === key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {Icon && <Icon className="h-4 w-4" />}
        <span>{label}</span>
        {badge != null && badge > 0 && (
          <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
            {badge}
          </span>
        )}
      </button>
    ))}
  </div>
);
