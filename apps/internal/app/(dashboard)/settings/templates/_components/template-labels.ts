import type { EmailTemplateGroup } from '@/lib/email/catalog'
import { BADGE_TINTS } from '@pts/ui/badge-tints'
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

/** One hue per kind of reader, so "who gets this" scans without reading. */
export const AUDIENCE_STYLES: Record<
  TemplateAudience,
  { label: string; badgeClassName: string }
> = {
  team: {
    label: 'Team',
    badgeClassName: BADGE_TINTS.sky,
  },
  client: {
    label: 'Client',
    badgeClassName: BADGE_TINTS.emerald,
  },
  visitor: {
    label: 'Visitor',
    badgeClassName: BADGE_TINTS.amber,
  },
}
