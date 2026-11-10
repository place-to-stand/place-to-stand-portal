import type { FieldValues } from 'react-hook-form'

import type { FormSnapshot } from './types'

/** What an entry holds besides the form: the sheet's own extra state and each source's. */
export type HistoryExternalState = {
  own: unknown
  sources: Record<string, unknown>
}

const signatureOf = (values: unknown, externalState: HistoryExternalState) =>
  JSON.stringify({ v: values, e: externalState })

/** Takes values and external state already cloned. */
export function buildSnapshot<T extends FieldValues>(
  values: T,
  externalState: HistoryExternalState
): FormSnapshot<T> {
  return {
    values,
    externalState,
    signature: signatureOf(values, externalState),
  }
}

/** The entry with one source's part replaced (or removed, for `undefined`). */
export function withSourceSlice<T extends FieldValues>(
  snapshot: FormSnapshot<T>,
  key: string,
  slice: unknown
): FormSnapshot<T> {
  const sources = { ...snapshot.externalState.sources }
  if (slice === undefined) {
    delete sources[key]
  } else {
    sources[key] = slice
  }
  return buildSnapshot(snapshot.values, {
    ...snapshot.externalState,
    sources,
  })
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date)

/** JSON with object keys sorted, so equal values compare equal. */
export function stableStringify(value: unknown): string {
  return (
    JSON.stringify(value, (_key, nested: unknown) =>
      isPlainObject(nested)
        ? Object.fromEntries(
            Object.keys(nested)
              .sort()
              .map(key => [key, nested[key]])
          )
        : nested
    ) ?? 'undefined'
  )
}

/**
 * A value with what loaded late put in: wherever it still holds the old
 * saved value (the placeholder), the newly loaded one; wherever it was
 * edited, the edit.
 */
function mergeLoaded(
  value: unknown,
  previous: unknown,
  next: unknown
): unknown {
  const nextSignature = stableStringify(next)
  if (stableStringify(previous) === nextSignature) return value
  if (stableStringify(value) === stableStringify(previous)) {
    return next === undefined ? undefined : structuredClone(next)
  }
  if (isPlainObject(value) && isPlainObject(previous) && isPlainObject(next)) {
    const merged: Record<string, unknown> = { ...value }
    for (const key of new Set([
      ...Object.keys(previous),
      ...Object.keys(next),
    ])) {
      const loaded = mergeLoaded(value[key], previous[key], next[key])
      if (loaded === undefined) delete merged[key]
      else merged[key] = loaded
    }
    return merged
  }
  return value
}

/** The entry with late-loaded saved values in place of their placeholders. */
export function withLoadedDefaults<T extends FieldValues>(
  snapshot: FormSnapshot<T>,
  previousDefaults: Partial<T>,
  nextDefaults: Partial<T>
): FormSnapshot<T> {
  const values = mergeLoaded(
    snapshot.values,
    previousDefaults,
    nextDefaults
  ) as T
  return values === snapshot.values
    ? snapshot
    : buildSnapshot(values, snapshot.externalState)
}
