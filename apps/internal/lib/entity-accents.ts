/**
 * Entity accent colors — the object-identity color system documented in
 * docs/design-system/components/sheet.md. Class strings are written out
 * literally (never interpolated) so Tailwind's scanner can see them.
 */

import {
  Briefcase,
  Building2,
  Clock3,
  FolderKanban,
  Handshake,
  ListTodo,
  Receipt,
  UserRound,
} from 'lucide-react'

export type AccentEntity =
  | 'task'
  | 'lead'
  | 'project'
  | 'client'
  | 'contact'
  | 'company'
  | 'suggestion'
  | 'invoice'
  | 'hourBlock'
  | 'user'
  | 'submission'
  | 'template'

type EntityAccent = {
  /** 2px bottom border used by sheet form headers. */
  sheetHeader: string
  /** Interactive card: tinted border at rest, stronger border + tint on hover. */
  card: string
  /** Static card (drag previews, non-interactive): tinted border only. */
  cardStatic: string
  /** The entity's icon tinted with its accent (list cells). */
  icon: string
}

export const ENTITY_ACCENTS: Record<AccentEntity, EntityAccent> = {
  task: {
    sheetHeader: 'border-b-2 border-b-violet-500/60',
    card: 'border-violet-500/35 hover:border-violet-500/60 hover:bg-violet-500/5 hover:shadow-md',
    cardStatic: 'border-violet-500/35',
    icon: 'text-violet-500',
  },
  lead: {
    sheetHeader: 'border-b-2 border-b-amber-500/60',
    card: 'border-amber-500/35 hover:border-amber-500/60 hover:bg-amber-500/5 hover:shadow-md',
    cardStatic: 'border-amber-500/35',
    icon: 'text-amber-500',
  },
  project: {
    sheetHeader: 'border-b-2 border-b-emerald-500/60',
    card: 'border-emerald-500/35 hover:border-emerald-500/60 hover:bg-emerald-500/5 hover:shadow-md',
    cardStatic: 'border-emerald-500/35',
    icon: 'text-emerald-500',
  },
  // The Client state of a company (badge, filters, billing): briefcase.
  client: {
    sheetHeader: 'border-b-2 border-b-blue-500/60',
    card: 'border-blue-500/35 hover:border-blue-500/60 hover:bg-blue-500/5 hover:shadow-md',
    cardStatic: 'border-blue-500/35',
    icon: 'text-blue-500',
  },
  contact: {
    sheetHeader: 'border-b-2 border-b-rose-500/60',
    card: 'border-rose-500/35 hover:border-rose-500/60 hover:bg-rose-500/5 hover:shadow-md',
    cardStatic: 'border-rose-500/35',
    icon: 'text-rose-500',
  },
  // A company: the building, in indigo.
  company: {
    sheetHeader: 'border-b-2 border-b-indigo-500/60',
    card: 'border-indigo-500/35 hover:border-indigo-500/60 hover:bg-indigo-500/5 hover:shadow-md',
    cardStatic: 'border-indigo-500/35',
    icon: 'text-indigo-500',
  },
  suggestion: {
    sheetHeader: 'border-b-2 border-b-fuchsia-500/60',
    card: 'border-fuchsia-500/35 hover:border-fuchsia-500/60 hover:bg-fuchsia-500/5 hover:shadow-md',
    cardStatic: 'border-fuchsia-500/35',
    icon: 'text-fuchsia-500',
  },
  invoice: {
    sheetHeader: 'border-b-2 border-b-orange-500/60',
    card: 'border-orange-500/35 hover:border-orange-500/60 hover:bg-orange-500/5 hover:shadow-md',
    cardStatic: 'border-orange-500/35',
    icon: 'text-orange-500',
  },
  hourBlock: {
    sheetHeader: 'border-b-2 border-b-teal-500/60',
    card: 'border-teal-500/35 hover:border-teal-500/60 hover:bg-teal-500/5 hover:shadow-md',
    cardStatic: 'border-teal-500/35',
    icon: 'text-teal-500',
  },
  user: {
    sheetHeader: 'border-b-2 border-b-rose-500/60',
    card: 'border-rose-500/35 hover:border-rose-500/60 hover:bg-rose-500/5 hover:shadow-md',
    cardStatic: 'border-rose-500/35',
    icon: 'text-rose-500',
  },
  submission: {
    sheetHeader: 'border-b-2 border-b-pink-500/60',
    card: 'border-pink-500/35 hover:border-pink-500/60 hover:bg-pink-500/5 hover:shadow-md',
    cardStatic: 'border-pink-500/35',
    icon: 'text-pink-500',
  },
  // Read-only catalog entries (Settings → Templates), so deliberately neutral.
  template: {
    sheetHeader: 'border-b-2 border-b-slate-500/60',
    card: 'border-slate-500/35 hover:border-slate-500/60 hover:bg-slate-500/5 hover:shadow-md',
    cardStatic: 'border-slate-500/35',
    icon: 'text-slate-500',
  },
}

/**
 * The entity a sidebar icon stands for, so a shared cell can tint an icon
 * with its entity's accent without each caller passing it. Keep in step with
 * components/layout/navigation-config.ts.
 */
const ENTITY_BY_ICON = new Map<unknown, AccentEntity>([
  [ListTodo, 'task'],
  [Handshake, 'lead'],
  [Receipt, 'invoice'],
  [Clock3, 'hourBlock'],
  // One icon per entity: a company (client or not) and a person.
  [Building2, 'company'],
  [Briefcase, 'client'],
  [UserRound, 'contact'],
  [FolderKanban, 'project'],
])

/** The accent icon class for a sidebar entity icon, or null for others. */
export function entityIconAccent(icon: unknown): string | null {
  const entity = ENTITY_BY_ICON.get(icon)
  return entity ? ENTITY_ACCENTS[entity].icon : null
}
