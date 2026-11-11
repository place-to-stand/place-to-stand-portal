import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { firstParam } from '@/lib/pagination/params'

// PRD 004 §03: per-view sort allowlist (D6/R5). Each field here has a
// matching descriptor (order expr + cursor encode/compare) in the query.
// An unknown field (e.g. the retired `clients`) falls back to the default.
const CONTACT_SORT_FIELDS = [
  'name',
  'companies',
  'email',
  'phone',
  'signIn',
  'created',
] as const
export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number]

export const DEFAULT_CONTACTS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<ContactSortField>

export function isContactSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (CONTACT_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

/**
 * Who can sign in, for the people queries: a role, any live sign-in, or
 * none. The Users page (/people/users) lists `any`, narrowed by its Role
 * filter (`?role=`).
 */
export const SIGN_IN_FILTER_VALUES = [
  'any',
  'ADMIN',
  'SALES',
  'CLIENT',
  'none',
] as const
export type SignInFilter = (typeof SIGN_IN_FILTER_VALUES)[number]
/** What the Users page's Role filter offers, A–Z. */
export const ROLE_FILTER_VALUES = ['ADMIN', 'CLIENT', 'SALES'] as const
export const ROLE_FILTER_LABELS: Record<
  (typeof ROLE_FILTER_VALUES)[number],
  string
> = {
  ADMIN: 'Admin',
  SALES: 'Sales',
  CLIENT: 'Client',
}
/**
 * The People and Archive pages' sign-in filter (`?type=`): people who can
 * sign in, or people who can't. Mirrors the Companies type filter
 * (Client / Not a client). Shown only to viewers who see sign-ins.
 */
export const PERSON_TYPE_VALUES = ['user', 'none'] as const
export type PersonTypeFilter = (typeof PERSON_TYPE_VALUES)[number]
export const PERSON_TYPE_LABELS: Record<PersonTypeFilter, string> = {
  user: 'User',
  none: 'Not a user',
}
export const isPersonType = (value: string): value is PersonTypeFilter =>
  (PERSON_TYPE_VALUES as readonly string[]).includes(value)
/** The sign-in condition a type filter stands for. */
export const PERSON_TYPE_SIGN_IN: Record<PersonTypeFilter, SignInFilter> = {
  user: 'any',
  none: 'none',
}

export const isRoleFilter = (
  value: string
): value is (typeof ROLE_FILTER_VALUES)[number] =>
  (ROLE_FILTER_VALUES as readonly string[]).includes(value)
export const isSignInFilter = (value: string): value is SignInFilter =>
  (SIGN_IN_FILTER_VALUES as readonly string[]).includes(value)

type RawSearchParams = Record<string, string | string[] | undefined>

export type ContactsSearchParams = {
  /** 1-based page for the offset-paginated contacts tables. */
  page: number
  search: string | undefined
  /**
   * Company filter (`?companyId=<uuid>`). Not `?company=`: that param opens
   * the company sheet.
   */
  companyId: string | undefined
  /** Who can sign in (admins only; ignored for others). */
  signIn: SignInFilter | undefined
  /** `?type=`: User or Not a user (People and Archive). */
  type: PersonTypeFilter | undefined
  sort: ParsedSort<ContactSortField>
}

/**
 * Shared searchParams parsing for the contacts pages (active + archive),
 * mirroring `parseUsersSearchParams`. Contacts paginate by offset, so the
 * pagination key here is `page` rather than cursor/dir.
 */
export function parseContactsSearchParams(
  params: RawSearchParams
): ContactsSearchParams {
  const pageParam = Number.parseInt(firstParam(params.page) ?? '1', 10)
  const searchParam = firstParam(params.q)?.trim()
  const clientIdParam = firstParam(params.companyId)?.trim()
  const typeParam = firstParam(params.type)?.trim() ?? ''
  // `?role=`; old links used `?signIn=` with the same values.
  const signInParam =
    (firstParam(params.role) ?? firstParam(params.signIn))?.trim() ?? ''
  const sort = parseSortParam(
    firstParam(params.sort),
    CONTACT_SORT_FIELDS,
    DEFAULT_CONTACTS_SORT
  )

  return {
    page: Math.max(1, Number.isFinite(pageParam) ? pageParam : 1),
    search: searchParam || undefined,
    companyId:
      clientIdParam && UUID_PATTERN.test(clientIdParam)
        ? clientIdParam
        : undefined,
    signIn: isSignInFilter(signInParam) ? signInParam : undefined,
    type: isPersonType(typeParam) ? typeParam : undefined,
    sort,
  }
}
