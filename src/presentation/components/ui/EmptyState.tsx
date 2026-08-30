import React from 'react';
import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}

// Replaces the bare «لا توجد بيانات» lines scattered through the app. Always
// tells the user what to do next.
export const EmptyState: React.FC<EmptyStateProps> = ({ title, hint, icon: Icon = Inbox, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-4">
    <Icon className="h-10 w-10 text-gray-300 mb-3" />
    <p className="text-sm font-semibold text-gray-600">{title}</p>
    {hint && <p className="text-xs text-gray-400 mt-1 max-w-xs">{hint}</p>}
    {action && (
      <button
        onClick={action.onClick}
        className="mt-4 text-sm font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        {action.label}
      </button>
    )}
  </div>
);
