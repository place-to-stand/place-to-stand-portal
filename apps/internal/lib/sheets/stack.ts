/**
 * The sheet stack as the URL holds it, as pure functions (no React), so the
 * rules can be tested on their own.
 *
 * Every open sheet is one `entity=value` query param, and param order is
 * stack order. The stack may hold several sheets of one entity (company A,
 * a person, then company B) and several create sheets of one entity (a new
 * person, a new company from its picker, a new person from that). What it
 * never holds twice is the same record: opening a record that is already in
 * the stack goes back to it, closing the sheets above (`openTarget`).
 */

import {
  UUID_PATTERN,
  isSheetEntityClaimed,
  isSheetEntityKey,
  isValidSheetParamValue,
  NEW_SHEET_VALUE,
  SHEET_ENTITIES,
  type SheetEntityKey,
} from './entities'

export type SheetStackItem = {
  entity: SheetEntityKey
  value: string
  /** How many sheets of this entity sit below it (0 for the first). */
  ordinal: number
  /**
   * Names this sheet among the open ones: `entity:value:n`, where n counts
   * the same entity and value below it (only create sheets repeat).
   */
  id: string
  /** Its param's position among the URL's params. */
  paramIndex: number
  /** Its place in the stack, 0 for the bottom sheet. */
  position: number
}

const itemId = (entity: SheetEntityKey, value: string, n: number) =>
  `${entity}:${value}:${n}`

/** A record id, as opposed to a create sheet (`new`, `copy-<id>`). */
export const isRecordValue = (value: string) => UUID_PATTERN.test(value)

/**
 * The sheet a page that renders its own sheet for `entity` shows: the bottom
 * of the stack, when it is that entity's, else undefined. Server pages read
 * their deep link with it so they agree with the client (`get`). Keys keep
 * the URL's order of first appearance, which is enough to find the bottom.
 */
export function pageSheetParam(
  entity: SheetEntityKey,
  searchParams: Record<string, string | string[] | undefined>
) {
  for (const [key, raw] of Object.entries(searchParams)) {
    if (!isSheetEntityKey(key)) continue
    const values = Array.isArray(raw) ? raw : raw ? [raw] : []
    const value = values.find(entry => isValidSheetParamValue(entry, key))
    if (value) {
      return key === entity ? value : undefined
    }
  }
  return undefined
}

/** Entity params in the URL, in stack order, each record once. */
export function parseSheetStack(
  params: Pick<URLSearchParams, 'entries'>
): SheetStackItem[] {
  const items: SheetStackItem[] = []
  let paramIndex = -1
  for (const [entity, value] of params.entries()) {
    paramIndex += 1
    if (
      !isSheetEntityKey(entity) ||
      !value ||
      !isValidSheetParamValue(value, entity)
    ) {
      continue
    }
    const same = items.filter(
      item => item.entity === entity && item.value === value
    ).length
    if (same > 0 && isRecordValue(value)) {
      continue
    }
    items.push({
      entity,
      value,
      ordinal: items.filter(item => item.entity === entity).length,
      id: itemId(entity, value, same),
      paramIndex,
      position: items.length,
    })
  }
  return items
}

/**
 * True when the page renders this sheet itself (see `claimsPathname`): only
 * the bottom sheet. Above another sheet the SheetHost shows it, so opening
 * one never sends the page to the server (which may redirect to another
 * tab and drop the stack), and a task added from a lead stays the lead's.
 */
export const isStackItemClaimed = (
  item: Pick<SheetStackItem, 'entity' | 'value' | 'position'>,
  pathname: string
) =>
  item.position === 0 && isSheetEntityClaimed(item.entity, pathname, item.value)

const rewrite = (
  params: URLSearchParams,
  entries: (readonly [string, string])[]
) => {
  for (const key of [...new Set(params.keys())]) {
    params.delete(key)
  }
  for (const [key, value] of entries) {
    params.append(key, value)
  }
}

/**
 * Drops these sheets' params (by id). An entity's aux params (create-sheet
 * prefills) go once no create sheet of that entity is left to read them.
 */
export function removeSheetParams(params: URLSearchParams, ids: string[]) {
  const removing = parseSheetStack(params).filter(item => ids.includes(item.id))
  if (removing.length === 0) {
    return
  }
  const dropped = new Set(removing.map(item => item.paramIndex))
  // A record's repeats (a hand-made URL) go with it, or closing it would
  // bring it back.
  const isRepeat = (key: string, value: string) =>
    isRecordValue(value) &&
    removing.some(item => item.entity === key && item.value === value)
  rewrite(
    params,
    [...params.entries()].filter(
      ([key, value], index) => !dropped.has(index) && !isRepeat(key, value)
    )
  )
  for (const entity of new Set(removing.map(item => item.entity))) {
    if (!params.getAll(entity).includes(NEW_SHEET_VALUE)) {
      for (const aux of SHEET_ENTITIES[entity].auxParams) {
        params.delete(aux)
      }
    }
  }
}

/** Points one sheet (by id) at another record, keeping its position. */
export function swapSheetParam(
  params: URLSearchParams,
  id: string,
  value: string
) {
  const item = parseSheetStack(params).find(entry => entry.id === id)
  if (!item) {
    return null
  }
  const entries = [...params.entries()]
  entries[item.paramIndex] = [item.entity, value]
  // The record may already be open elsewhere in the stack: it keeps this
  // place only, never two.
  rewrite(
    params,
    entries.filter(
      ([key, entryValue], index) =>
        index === item.paramIndex ||
        !(isRecordValue(value) && key === item.entity && entryValue === value)
    )
  )
  return item
}

/**
 * Sets the entity's first sheet (a page's own, when it is the bottom) to `value`
 * in place, appends it when there is none, or removes it for null. Other
 * sheets of the entity stay where they are.
 */
export function setFirstSheetParam(
  params: URLSearchParams,
  entity: SheetEntityKey,
  value: string | null
) {
  const first = parseSheetStack(params).find(item => item.entity === entity)
  if (!first) {
    if (value) {
      params.append(entity, value)
    }
    return
  }
  if (value) {
    swapSheetParam(params, first.id, value)
  } else {
    removeSheetParams(params, [first.id])
  }
}

export type SheetOpenTarget =
  /** Already open: close these sheets (top first) to get back to it. */
  | { kind: 'back'; item: SheetStackItem; above: SheetStackItem[] }
  /** Not open: stack it on top. */
  | { kind: 'stack' }

/**
 * What opening `entity=value` does to this stack. A record already open is
 * gone back to; a create sheet always stacks, since two drafts are never
 * the same record.
 */
export function openTarget(
  stack: SheetStackItem[],
  entity: SheetEntityKey,
  value: string
): SheetOpenTarget {
  const index = isRecordValue(value)
    ? stack.findIndex(item => item.entity === entity && item.value === value)
    : -1
  if (index === -1) {
    return { kind: 'stack' }
  }
  return {
    kind: 'back',
    item: stack[index]!,
    above: stack.slice(index + 1).reverse(),
  }
}
