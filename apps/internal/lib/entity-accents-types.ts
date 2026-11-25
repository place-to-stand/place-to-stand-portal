import type { LucideIcon } from 'lucide-react'

/** The types behind the entity registry (`ENTITIES` in ./entity-accents). */

export type AccentEntity =
  | 'lead'
  | 'company'
  | 'contact'
  | 'user'
  | 'project'
  | 'task'
  | 'timeLog'
  | 'feedback'
  | 'client'
  | 'invoice'
  | 'hourBlock'
  | 'submission'
  | 'template'

export type EntityGroup = 'sales' | 'work' | 'money' | 'admin'

export type EntityAccent = {
  /** 2px bottom border used by sheet form headers. */
  sheetHeader: string
  /** Interactive card: tinted border at rest, stronger border + tint on hover. */
  card: string
  /** Static card (drag previews, non-interactive): tinted border only. */
  cardStatic: string
  /** The entity's icon tinted with its accent (list cells). */
  icon: string
  /** A soft fill behind the icon or a row. */
  tint: string
  /** A quiet band behind a group row (a list's client header): half the tint. */
  band: string
  /** A filled badge (activity verbs): soft fill, accent text. */
  badge: string
}

export type EntityDefinition = {
  /** UI name. The person record is a "Person", a user is a "Sign-in". */
  label: string
  /**
   * A state of another entity (client of company, sign-in of person): its
   * icon is that entity's icon with a dot in this entity's colour, and the
   * icon keeps that entity's colour.
   */
  stateOf?: AccentEntity
  group: EntityGroup
  icon: LucideIcon
  /** The icon's lucide name, for docs and the design system page. */
  iconName: string
  /**
   * A glyph this entity used to have, still banned outside the registry so
   * it can't come back as a second icon for the same record.
   */
  retiredIcon?: string
  /** Its colour token: `--entity-<token>` in theme.css. */
  token: string
  /** A sample record name for the design system page. */
  example: string
  accent: EntityAccent
}
