import { describe, it, expect } from 'vitest';
import { convertQty, canConvert } from './units';
import type { UnitConversion } from '../../core/domain/entities';

const conv = (from: string, to: string, factor: number): UnitConversion => ({
  id: `${from}-${to}`,
  from_unit_id: from,
  to_unit_id: to,
  factor,
  created_at: '',
  updated_at: '',
});

// Mirrors the rows seeded by the cycle_foundation migration.
const CONVERSIONS: UnitConversion[] = [
  conv('g', 'kg', 0.001),
  conv('kg', 'g', 1000),
  conv('ml', 'liter', 0.001),
  conv('liter', 'ml', 1000),
];

describe('convertQty', () => {
  it('returns the quantity unchanged when units match or are missing', () => {
    expect(convertQty(5, 'g', 'g', CONVERSIONS)).toBe(5);
    expect(convertQty(5, null, 'g', CONVERSIONS)).toBe(5);
    expect(convertQty(5, 'g', undefined, CONVERSIONS)).toBe(5);
  });

  it('applies a direct conversion', () => {
    expect(convertQty(2000, 'g', 'kg', CONVERSIONS)).toBe(2);
    expect(convertQty(1.5, 'liter', 'ml', CONVERSIONS)).toBe(1500);
  });

  it('applies the reverse of a conversion when only the opposite row exists', () => {
    const oneWay = [conv('g', 'kg', 0.001)];
    expect(convertQty(3, 'kg', 'g', oneWay)).toBe(3000);
  });

  it('returns null when no path exists', () => {
    expect(convertQty(5, 'g', 'ml', CONVERSIONS)).toBeNull();
    expect(convertQty(5, 'piece', 'kg', CONVERSIONS)).toBeNull();
  });

  it('returns null for a non-numeric quantity', () => {
    expect(convertQty(Number.NaN, 'g', 'kg', CONVERSIONS)).toBeNull();
  });
});

describe('canConvert', () => {
  it('is true for same unit and for a known pair, false otherwise', () => {
    expect(canConvert('g', 'g', CONVERSIONS)).toBe(true);
    expect(canConvert('g', 'kg', CONVERSIONS)).toBe(true);
    expect(canConvert('g', 'ml', CONVERSIONS)).toBe(false);
  });
});
