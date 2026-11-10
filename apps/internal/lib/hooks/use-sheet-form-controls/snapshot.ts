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
