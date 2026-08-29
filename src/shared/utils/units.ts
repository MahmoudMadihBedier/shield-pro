import { UnitConversion } from '../../core/domain/entities';

// Convert a quantity from one unit to another using the seeded
// public.unit_conversions rows. A recipe line may be authored in grams while
// the raw material is stocked (and costed) in kg, so BOM explosion and cost
// roll-ups must normalise units before doing arithmetic.
//
// Returns null when there is no known path between the two units — callers
// decide whether that's a hard error (block the action) or a soft one (show
// the figure as unavailable).
export function convertQty(
  qty: number,
  fromUnitId: string | null | undefined,
  toUnitId: string | null | undefined,
  conversions: UnitConversion[]
): number | null {
  if (qty == null || Number.isNaN(qty)) return null;
  if (!fromUnitId || !toUnitId || fromUnitId === toUnitId) return qty;

  const direct = conversions.find(
    (c) => c.from_unit_id === fromUnitId && c.to_unit_id === toUnitId
  );
  if (direct && Number(direct.factor) !== 0) return qty * Number(direct.factor);

  const reverse = conversions.find(
    (c) => c.from_unit_id === toUnitId && c.to_unit_id === fromUnitId
  );
  if (reverse && Number(reverse.factor) !== 0) return qty / Number(reverse.factor);

  return null;
}

// True when the two units can be reconciled (same unit, or a conversion
// exists either direction).
export function canConvert(
  fromUnitId: string | null | undefined,
  toUnitId: string | null | undefined,
  conversions: UnitConversion[]
): boolean {
  return convertQty(1, fromUnitId, toUnitId, conversions) !== null;
}
