import React from 'react';
import type { LucideIcon } from 'lucide-react';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'gray';

const TONES: Record<Tone, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-600' },
};

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
}

// Promoted from the copy redefined inside Dashboard / Accounting / RepLedger /
// BranchCashSettlements. Every KPI number gets a label saying what it means.
export const StatCard: React.FC<StatCardProps> = ({ title, value, unit, hint, icon: Icon, tone = 'blue' }) => {
  const t = TONES[tone];
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500">{title}</p>
        {Icon && (
          <span className={`${t.bg} ${t.text} rounded-md p-1.5`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
};
