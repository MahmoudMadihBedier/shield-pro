import React from 'react';

interface NumberInputProps {
  value: number | '' | null | undefined;
  onChange: (value: number | '') => void;
  /** unit chip shown at the edge of the field ("ج.م", "جم", "%") */
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  className?: string;
}

// Numeric field with a visible unit chip and sane empty handling (no forced
// "0" the user has to clear). inputMode="decimal" for phone keyboards.
export const NumberInput: React.FC<NumberInputProps> = ({
  value, onChange, unit, placeholder, disabled, min, max, className = '',
}) => (
  <div className={`relative ${className}`}>
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={min}
      max={max}
      disabled={disabled}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      className={`w-full border rounded-lg py-2 px-3 text-sm disabled:bg-gray-50 disabled:text-gray-500 ${unit ? 'pl-12' : ''}`}
    />
    {unit && (
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-400 pointer-events-none">
        {unit}
      </span>
    )}
  </div>
);

// Convenience wrappers so intent reads clearly at call sites.
export const MoneyInput: React.FC<Omit<NumberInputProps, 'unit'>> = (p) => (
  <NumberInput {...p} unit="ج.م" min={p.min ?? 0} />
);

export const QtyInput: React.FC<NumberInputProps> = (p) => (
  <NumberInput {...p} min={p.min ?? 0} />
);
