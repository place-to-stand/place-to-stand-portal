/** Search params as Next hands them to a page. */
export type RawSearchParams = Record<string, string | string[] | undefined>

/** The first value of a search param: `?a=1&a=2` reads as "1". */
export function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
