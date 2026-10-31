/**
 * The sheet deep-link registry.
 *
 * Every entity sheet is addressed by a single query param (`?client=<uuid>`,
 * `?task=new`, …) that works on any dashboard route. The param's position in
 * the URL is its position in the sheet stack: opening a sheet appends its
 * param, so `?lead=<id>&task=new` renders the task sheet on top of the lead
 * sheet. Canonical host pages (the entity's own list page) render their own
 * sheet instances for instant opens; the global SheetHost covers every other
 * route via `claimsPathname`.
 */

const SHEET_ENTITY_KEYS = [
  'task',
  'lead',
  'client',
  'contact',
  'invoice',
  'submission',
  'hour-block',
  'user',
  'project',
  'company',
] as const

export type SheetEntityKey = (typeof SHEET_ENTITY_KEYS)[number]

/** Param value that opens an entity's create sheet (`?lead=new`). */
export const NEW_SHEET_VALUE = 'new'

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isValidSheetParamValue = (value: string) =>
  value === NEW_SHEET_VALUE || UUID_PATTERN.test(value)

type SheetEntityConfig = {
  /**
   * Aux params carrying sub-state for this entity's sheet (always prefixed
   * with the entity param, e.g. `tab=billing`). Removed alongside the
   * entity param on close.
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
  client: {
    // Old links only: `?client=<id>` opens that company's sheet (a client is
    // a company you bill). Billing is switched on from the company's billing (its sheet's Client column).
    auxParams: ['tab'],
    claimsPathname: () => false,
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
  user: {
    auxParams: [],
    // Old links only: a sign-in is managed on its person, so the global host
    // opens `?user=<id>` as that person's sheet.
    claimsPathname: () => false,
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

/** True when the page renders its own sheet for this entity + value. */
export const isSheetEntityClaimed = (
  entity: SheetEntityKey,
  pathname: string,
  value: string
) => SHEET_ENTITIES[entity].claimsPathname(pathname, value)
