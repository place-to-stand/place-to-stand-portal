/**
 * The sheet stack as the URL holds it, as pure functions (no React), so the
 * rules can be tested on their own.
 *
 * Every open sheet is one `entity=value` query param, and param order is
 * stack order. The stack may hold several sheets of one entity (company A,
 * a person, then company B); what it never holds twice is the same record:
 * opening a record that is already in the stack goes back to it, closing
 * the sheets above (`openTarget`).
 */

import {
  NEW_SHEET_VALUE,
  SHEET_ENTITIES,
  isSheetEntityClaimed,
  isSheetEntityKey,
  isValidSheetParamValue,
  type SheetEntityKey,
} from './entities'

export type SheetStackItem = {
  entity: SheetEntityKey
  value: string
  /**
   * How many sheets of this entity sit below it (0 for the first). A page
   * that renders its own sheet for an entity shows the first one only; the
   * global SheetHost shows the rest.
   */
  ordinal: number
  /**
   * Stays the same while the sheet is open, even when a create sheet swaps
   * `new` for the saved record's id, so the sheet isn't remounted.
   */
  key: string
}

export const sheetItemKey = (entity: SheetEntityKey, ordinal: number) =>
  `${entity}#${ordinal}`

/** Entity params in the URL, in stack order, each record once. */
export function parseSheetStack(params: URLSearchParams): SheetStackItem[] {
  const items: SheetStackItem[] = []
  for (const [entity, value] of params.entries()) {
    if (
      !isSheetEntityKey(entity) ||
      !value ||
      !isValidSheetParamValue(value, entity) ||
      items.some(item => item.entity === entity && item.value === value)
    ) {
      continue
    }
    const ordinal = items.filter(item => item.entity === entity).length
    items.push({ entity, value, ordinal, key: sheetItemKey(entity, ordinal) })
  }
  return items
}

export const findSheetIndex = (
  stack: SheetStackItem[],
  entity: SheetEntityKey,
  value: string
) => stack.findIndex(item => item.entity === entity && item.value === value)

/** True when the page renders this sheet itself (see `claimsPathname`). */
export const isStackItemClaimed = (item: SheetStackItem, pathname: string) =>
  item.ordinal === 0 && isSheetEntityClaimed(item.entity, pathname, item.value)

/**
 * Drops these sheets' params. An entity's aux params (create-sheet
 * prefills) go once no create sheet of that entity is left to read them.
 */
export function removeSheetParams(
  params: URLSearchParams,
  items: Pick<SheetStackItem, 'entity' | 'value'>[]
) {
  const isRemoved = (key: string, value: string) =>
    items.some(item => item.entity === key && item.value === value)
  const kept = [...params.entries()].filter(
    ([key, value]) => !isRemoved(key, value)
  )
  for (const key of [...new Set(params.keys())]) {
    params.delete(key)
  }
  for (const [key, value] of kept) {
    params.append(key, value)
  }
  for (const entity of new Set(items.map(item => item.entity))) {
    if (!params.getAll(entity).includes(NEW_SHEET_VALUE)) {
      for (const aux of SHEET_ENTITIES[entity].auxParams) {
        params.delete(aux)
      }
    }
  }
}

/** Points one sheet's param at another record, keeping its position. */
export function swapSheetParam(
  params: URLSearchParams,
  entity: SheetEntityKey,
  from: string,
  to: string
) {
  const entries = [...params.entries()]
  const index = entries.findIndex(
    ([key, value]) => key === entity && value === from
  )
  if (index === -1) {
    return false
  }
  entries[index] = [entity, to]
  for (const key of [...new Set(params.keys())]) {
    params.delete(key)
  }
  for (const [key, value] of entries) {
    params.append(key, value)
  }
  return true
}

export type SheetOpenTarget =
  /** Already open: close these sheets (top first) to get back to it. */
  | { kind: 'back'; index: number; above: SheetStackItem[] }
  /** Not open: stack it on top as this item. */
  | { kind: 'stack'; item: SheetStackItem }

/** What opening `entity=value` does to this stack. */
export function openTarget(
  stack: SheetStackItem[],
  entity: SheetEntityKey,
  value: string
): SheetOpenTarget {
  const index = findSheetIndex(stack, entity, value)
  if (index !== -1) {
    return { kind: 'back', index, above: stack.slice(index + 1).reverse() }
  }
  const ordinal = stack.filter(item => item.entity === entity).length
  return {
    kind: 'stack',
    item: { entity, value, ordinal, key: sheetItemKey(entity, ordinal) },
  }
}
