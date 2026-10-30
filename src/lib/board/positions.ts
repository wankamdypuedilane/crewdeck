// Fractional positions: a task moved between two others gets the number in the
// middle, so only the moved row is written. 1024 leaves room for ~50 halvings
// before two neighbours become indistinguishable; then the column is renumbered.

export const POSITION_STEP = 1024;
export const MIN_GAP = 1e-6;

/** A position strictly between `before` and `after` (either may be missing). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return POSITION_STEP;
  if (before === null) return after! - POSITION_STEP;
  if (after === null) return before + POSITION_STEP;
  if (after <= before) throw new RangeError("`after` must be greater than `before`");
  return (before + after) / 2;
}

/** True when the neighbours are too close to fit a new position safely. */
export function needsRebalance(before: number | null, after: number | null): boolean {
  return before !== null && after !== null && after - before < MIN_GAP;
}
