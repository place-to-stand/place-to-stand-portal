/**
 * Entity accent colors — the object-identity color system documented in
 * docs/design-system.md. Class strings are written out literally (never
 * interpolated) so Tailwind's scanner can see them.
 */

export type AccentEntity =
  | 'task'
  | 'lead'
  | 'project'
  | 'client'
  | 'contact'
  | 'suggestion'
  | 'invoice'
  | 'hourBlock'
  | 'user'
  | 'submission'

type EntityAccent = {
  /** 2px bottom border used by sheet form headers. */
  sheetHeader: string
  /** Interactive card: tinted border at rest, stronger border + tint on hover. */
  card: string
  /** Static card (drag previews, non-interactive): tinted border only. */
  cardStatic: string
}

export const ENTITY_ACCENTS: Record<AccentEntity, EntityAccent> = {
  task: {
    sheetHeader: 'border-b-2 border-b-violet-500/60',
    card: 'border-violet-500/35 hover:border-violet-500/60 hover:bg-violet-500/5 hover:shadow-md',
    cardStatic: 'border-violet-500/35',
  },
  lead: {
    sheetHeader: 'border-b-2 border-b-amber-500/60',
    card: 'border-amber-500/35 hover:border-amber-500/60 hover:bg-amber-500/5 hover:shadow-md',
    cardStatic: 'border-amber-500/35',
  },
  project: {
    sheetHeader: 'border-b-2 border-b-emerald-500/60',
    card: 'border-emerald-500/35 hover:border-emerald-500/60 hover:bg-emerald-500/5 hover:shadow-md',
    cardStatic: 'border-emerald-500/35',
  },
  client: {
    sheetHeader: 'border-b-2 border-b-blue-500/60',
    card: 'border-blue-500/35 hover:border-blue-500/60 hover:bg-blue-500/5 hover:shadow-md',
    cardStatic: 'border-blue-500/35',
  },
  contact: {
    sheetHeader: 'border-b-2 border-b-cyan-500/60',
    card: 'border-cyan-500/35 hover:border-cyan-500/60 hover:bg-cyan-500/5 hover:shadow-md',
    cardStatic: 'border-cyan-500/35',
  },
  suggestion: {
    sheetHeader: 'border-b-2 border-b-fuchsia-500/60',
    card: 'border-fuchsia-500/35 hover:border-fuchsia-500/60 hover:bg-fuchsia-500/5 hover:shadow-md',
    cardStatic: 'border-fuchsia-500/35',
  },
  invoice: {
    sheetHeader: 'border-b-2 border-b-orange-500/60',
    card: 'border-orange-500/35 hover:border-orange-500/60 hover:bg-orange-500/5 hover:shadow-md',
    cardStatic: 'border-orange-500/35',
  },
  hourBlock: {
    sheetHeader: 'border-b-2 border-b-teal-500/60',
    card: 'border-teal-500/35 hover:border-teal-500/60 hover:bg-teal-500/5 hover:shadow-md',
    cardStatic: 'border-teal-500/35',
  },
  user: {
    sheetHeader: 'border-b-2 border-b-rose-500/60',
    card: 'border-rose-500/35 hover:border-rose-500/60 hover:bg-rose-500/5 hover:shadow-md',
    cardStatic: 'border-rose-500/35',
  },
  submission: {
    sheetHeader: 'border-b-2 border-b-pink-500/60',
    card: 'border-pink-500/35 hover:border-pink-500/60 hover:bg-pink-500/5 hover:shadow-md',
    cardStatic: 'border-pink-500/35',
  },
}
