import { NAV_GROUPS } from '@/components/layout/navigation-config'

/**
 * Breadcrumb segment (PRD 004 §01, D2). Group segments carry no href —
 * they have no landing pages; section segments link; the final segment
 * is plain text.
 */
export type Crumb = {
  label: string
  href?: string
}

/**
 * Derive the static `Group / Section` breadcrumb prefix for a nav href.
 * Pages append record segments themselves (record names come from page data).
 */
export function crumbsForNav(href: string): Crumb[] {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === href) {
        const crumbs: Crumb[] = []
        if (group.title) {
          crumbs.push({ label: group.title })
        }
        crumbs.push({ label: item.label, href: item.href })
        return crumbs
      }
    }
  }
  return []
}
