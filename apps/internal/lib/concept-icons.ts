import {
  History,
  MessageCircle,
  Paperclip,
  type LucideIcon,
} from 'lucide-react'

/**
 * One icon per non-entity concept, so a task card's comment count and the
 * task sheet's Comments heading show the same thing. Entities (task, lead,
 * company…) live in `ENTITY_ICONS`; these are the things records carry.
 */
export const CONCEPT_ICONS = {
  comment: MessageCircle,
  attachment: Paperclip,
  activity: History,
} as const satisfies Record<string, LucideIcon>
