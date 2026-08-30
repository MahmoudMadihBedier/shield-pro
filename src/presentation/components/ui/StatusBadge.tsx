import React from 'react';
import { enumLabel, badgeTone, type BadgeTone } from '../../../shared/i18n/labels';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
};

interface StatusBadgeProps {
  /** enum group name from src/shared/i18n/labels.ts (e.g. 'invoiceStatus') */
  group: string;
  value: string | null | undefined;
  /** override the tone derived from the value */
  tone?: BadgeTone;
  className?: string;
}

// One consistent pill for every status / type value in the app. Never render
// a raw enum string — go through this.
export const StatusBadge: React.FC<StatusBadgeProps> = ({ group, value, tone, className = '' }) => {
  const t = tone ?? badgeTone(group, value);
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${TONE_CLASSES[t]} ${className}`}
    >
      {enumLabel(group, value)}
    </span>
  );
};
