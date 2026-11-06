/**
 * The sheet deep-link registry.
 *
 * Every entity sheet is addressed by a single query param (`?company=<uuid>`,
 * `?task=new`, …) that works on any dashboard route. The param's position in
 * the URL is its position in the sheet stack: opening a sheet appends its
 * param, so `?lead=<id>&task=new` renders the task sheet on top of the lead
 * sheet. Canonical host pages (the entity's own list page) render their own
 * sheet instances for instant opens; the global SheetHost covers every other
 * route via `claimsPathname`.
 */

import { UUID_PATTERN } from '@pts/db/uuid'

const SHEET_ENTITY_KEYS = [
  'task',
  'lead',
  'contact',
  'invoice',
  'submission',
  'hour-block',
  'project',
  'company',
] as const

export type SheetEntityKey = (typeof SHEET_ENTITY_KEYS)[number]

/** Param value that opens an entity's create sheet (`?lead=new`). */
export const NEW_SHEET_VALUE = 'new'

export { UUID_PATTERN }

/**
 * Param value prefix that opens an entity's create sheet filled in from an
 * existing record: `?task=copy-<uuid>` duplicates that task. Saving creates a
 * new record; the source is never touched.
 */
const DUPLICATE_SHEET_PREFIX = 'copy-'

/** The param value that duplicates `id` (`copy-<uuid>`). */
export const duplicateSheetValue = (id: string) =>
  `${DUPLICATE_SHEET_PREFIX}${id}`

/** The source record's id when `value` is a duplicate, else null. */
export const parseDuplicateSourceId = (value: string | null | undefined) => {
  if (!value?.startsWith(DUPLICATE_SHEET_PREFIX)) {
    return null
  }
  const id = value.slice(DUPLICATE_SHEET_PREFIX.length)
  return UUID_PATTERN.test(id) ? id : null
}

/** `new` or a record id: what a sheet loads (a copy loads its source's id). */
export const isSheetRecordValue = (value: string) =>
  value === NEW_SHEET_VALUE || UUID_PATTERN.test(value)

/**
 * A value the `entity` param may hold: `new`, a record id, or `copy-<id>` for
 * entities that can be duplicated. Anything else is ignored, never sent on to
 * a lookup that casts it to a uuid.
 */
export const isValidSheetParamValue = (value: string, entity: string) =>
  isSheetRecordValue(value) ||
  (isDuplicableSheetEntity(entity) && parseDuplicateSourceId(value) !== null)

/**
 * The entities whose create sheet can start from a copy of an existing
 * record. Companies and people are one-of-a-kind (a second "Acme" is a
 * mistake, not a copy), submissions arrive from the website, and a project's
 * worth is its tasks, which a copy of its details wouldn't carry, so those
 * have no Duplicate.
 */
export const DUPLICABLE_SHEET_ENTITIES = [
  'task',
  'lead',
  'invoice',
  'hour-block',
] as const satisfies readonly SheetEntityKey[]

export type DuplicableSheetEntity = (typeof DUPLICABLE_SHEET_ENTITIES)[number]

export const isDuplicableSheetEntity = (
  entity: string
): entity is DuplicableSheetEntity =>
  (DUPLICABLE_SHEET_ENTITIES as readonly string[]).includes(entity)

type SheetEntityConfig = {
  /**
   * Aux params carrying sub-state for this entity's sheet (always prefixed
   * with the entity param, e.g. `companyName=`). Removed alongside the
   * entity param on close. `tab` is listed only so old `?tab=` links are
   * dropped on close: sheets have no tabs and ignore it.
   */
  auxParams: readonly string[]
  /**
   * True when this page renders its own sheet for the entity — the global
   * SheetHost skips claimed params. Takes the param value too, so a page can
   * claim existing records but not `new` (an archive list, say).
   */
  claimsPathname: (pathname: string, value: string) => boolean
}

const exactPaths =
  (...paths: string[]) =>
  (pathname: string) =>
    paths.includes(pathname)

export const SHEET_ENTITIES: Record<SheetEntityKey, SheetEntityConfig> = {
  task: {
    auxParams: [],
    claimsPathname: pathname =>
      /^\/my\/tasks(\/|$)/.test(pathname) ||
      /^\/projects\/[^/]+\/[^/]+\/(tasks|review)$/.test(pathname),
  },
  lead: {
    auxParams: [],
    // Only the board hosts the create sheet; the archive lists existing
    // leads, so `?lead=new` there falls through to the global host.
    claimsPathname: (pathname, value) =>
      pathname === '/leads' ||
      (pathname === '/leads/archive' && value !== NEW_SHEET_VALUE),
  },
  contact: {
    // `contactName=` prefills the create sheet's name (create-from-picker);
    // `contactCompanyId=` its company (e.g. the lead's).
    auxParams: ['contactName', 'contactCompanyId'],
    claimsPathname: exactPaths('/people', '/people/archive'),
  },
  invoice: {
    auxParams: [],
    claimsPathname: exactPaths('/invoices', '/invoices/archive'),
  },
  submission: {
    auxParams: [],
    claimsPathname: exactPaths('/submissions', '/submissions/archive'),
  },
  'hour-block': {
    auxParams: [],
    claimsPathname: exactPaths('/hour-blocks', '/hour-blocks/archive'),
  },
  project: {
    // `projectCompanyId=` prefills the create sheet's client (a company's
    // Projects, in its sheet's Client column).
    auxParams: ['projectCompanyId'],
    // Unclaimed everywhere: the projects tables can't resolve an arbitrary
    // project id from their own rows (the landing's row type omits fields
    // the sheet needs), so the host serves `?project=` on every route and
    // those tables keep their own local-state sheet for row clicks.
    claimsPathname: () => false,
  },
  company: {
    // `companyName=` prefills the create sheet's name (create-from-picker).
    auxParams: ['companyName', 'tab'],
    // The company sheet loads its own data, so the global host serves it on
    // every route, the Companies page included.
    claimsPathname: () => false,
  },
}

export const isSheetEntityKey = (value: string): value is SheetEntityKey =>
  (SHEET_ENTITY_KEYS as readonly string[]).includes(value)

/**
 * True when the page renders its own sheet for this entity + value. A
 * duplicate (`copy-<uuid>`) is never claimed: the SheetHost's wrappers load
 * the source record, so every page gets the same copy flow.
 */
export const isSheetEntityClaimed = (
  entity: SheetEntityKey,
  pathname: string,
  value: string
) =>
  parseDuplicateSourceId(value) === null &&
  SHEET_ENTITIES[entity].claimsPathname(pathname, value)
