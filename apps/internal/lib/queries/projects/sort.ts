import type { ParsedSort } from '@/lib/pagination/sort'

// PRD 004 §03: projects settings/archive sort allowlist. Client-safe module
// (no server-only imports) — consumed by both the server query descriptors
// and the client-side param parsing.
export const PROJECT_SORT_FIELDS = ['name', 'created'] as const
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number]

export const DEFAULT_PROJECTS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<ProjectSortField>
