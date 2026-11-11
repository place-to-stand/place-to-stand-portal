'use client'

/**
 * Return channel for "create from inside a picker" (the sibling of
 * pending-open.ts). A picker opens a create sheet stacked above its own
 * (`?company=<id>&contact=new`); when that sheet saves, its wrapper emits the
 * new record here and the host picker — still mounted underneath — selects
 * it locally. Links are persisted with the host's own save, so nothing hits
 * the server twice.
 */
export type SheetCreatedRecords = {
  contact: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  company: { id: string; name: string }
}

export type SheetCreatedEntity = keyof SheetCreatedRecords

type Listener<E extends SheetCreatedEntity> = (
  record: SheetCreatedRecords[E],
  /**
   * The stack id of the create sheet that saved it, as `openNew` returned
   * it: a listener takes only the record of the sheet it opened.
   */
  stackId: string | null
) => void

const listeners: { [E in SheetCreatedEntity]: Set<Listener<E>> } = {
  contact: new Set(),
  company: new Set(),
}

export function emitSheetCreated<E extends SheetCreatedEntity>(
  entity: E,
  record: SheetCreatedRecords[E],
  stackId: string | null
) {
  for (const listener of listeners[entity]) {
    listener(record, stackId)
  }
}

export function subscribeSheetCreated<E extends SheetCreatedEntity>(
  entity: E,
  listener: Listener<E>
) {
  listeners[entity].add(listener)
  return () => {
    listeners[entity].delete(listener)
  }
}
