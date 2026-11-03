/**
 * Time logs and hour blocks count in quarter hours (0.25, 0.5, 0.75, 1…).
 * The database checks the same rule (0125: `% 0.25 = 0`). Client-safe.
 */
export const HOURS_STEP = 0.25

export const QUARTER_HOURS_MESSAGE =
  'Use quarter hours: 0.25, 0.5, 0.75, 1 and so on.'

export function isQuarterHours(value: number): boolean {
  const quarters = value * 4
  return Math.abs(quarters - Math.round(quarters)) < 1e-9
}
