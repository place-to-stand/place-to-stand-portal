import type { EmailTemplateGroup } from '@/lib/email/catalog'
import type { TemplateAudience } from '@/lib/templates/audience'

/** Section order and headings for the emails gallery; key order is display order. */
export const EMAIL_GROUP_LABELS: Record<EmailTemplateGroup, string> = {
  accounts: 'Sign-in & accounts',
  'contact-form': 'Contact form',
  audit: 'Opportunity Audit',
  client: 'Client updates',
}

export const TEMPLATE_AUDIENCES: TemplateAudience[] = [
  'team',
  'client',
  'visitor',
]

/**
 * One hue per kind of reader, so "who gets this" scans without reading. Badge
 * classes follow the billing-type and project-status badges.
 */
export const AUDIENCE_STYLES: Record<
  TemplateAudience,
  { label: string; badgeClassName: string }
> = {
  team: {
    label: 'Team',
    badgeClassName:
      'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300',
  },
  client: {
    label: 'Client',
    badgeClassName:
      'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  visitor: {
    label: 'Visitor',
    badgeClassName:
      'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  },
}

/** Matches the invoice share page's headline face. */
export const HEADLINE_FONT = 'font-[family-name:var(--font-space-grotesk)]'
