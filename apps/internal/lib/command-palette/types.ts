import type { AccentEntity } from '@/lib/entity-accents'

/**
 * One ⌘K record result. Every kind of record has the same shape, so the
 * palette draws them all one way and every result opens its sheet (projects
 * open their board, as project links do everywhere).
 */
export type PaletteRecord = {
  id: string
  title: string
  /** Muted text after the title: the company, project or email. */
  detail: string | null
  /** Where picking it goes: the record's sheet on its own page. */
  href: string
  /** Icon and colour; a state (client, sign-in) picks its own entity. */
  entity: AccentEntity
  /**
   * Other text the search matched (a lead's email, a submission's company).
   * The palette filters again as you type, so a match it can't see would
   * hide the row.
   */
  keywords?: string[]
  /** Clients only: the billing type, shown at the end of the row. */
  billingType?: 'prepaid' | 'net_30' | null
}

/**
 * Result groups. With text in the search box cmdk sorts groups and rows by
 * match, so this order (and each query's) only breaks ties.
 */
export const PALETTE_GROUPS = [
  { key: 'companies', heading: 'Companies' },
  { key: 'people', heading: 'People' },
  { key: 'leads', heading: 'Leads' },
  { key: 'submissions', heading: 'Submissions' },
  { key: 'projects', heading: 'Projects' },
  { key: 'tasks', heading: 'Tasks' },
  { key: 'invoices', heading: 'Invoices' },
  { key: 'hourBlocks', heading: 'Hour blocks' },
] as const

export type PaletteGroupKey = (typeof PALETTE_GROUPS)[number]['key']

export type PaletteSearchResult = Record<PaletteGroupKey, PaletteRecord[]>
