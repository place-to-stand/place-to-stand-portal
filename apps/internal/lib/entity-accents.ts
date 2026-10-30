/**
 * The entity registry: the one place each kind of record gets its name, its
 * icon and its colour. The sidebar, sheets, badges, list cells, the activity
 * feed and /design all read from here; nothing else imports an entity icon
 * from lucide-react or writes an entity colour (eslint and
 * scripts/check-entities.mjs enforce it). Documented in
 * docs/design-system/README.md and components/sheet.md.
 *
 * Colours are theme tokens (`--entity-*` in packages/ui/src/styles/theme.css,
 * light and dark), grouped by job: sales warm, work green, money blue, admin
 * neutral. Every icon clears 3:1 on a card in both themes. Class strings are
 * written out literally (never interpolated) so Tailwind's scanner sees them.
 */

/* eslint-disable no-restricted-imports -- the registry owns these icons */
import {
  Briefcase,
  Building2,
  Clock,
  FolderKanban,
  Handshake,
  Hourglass,
  Inbox,
  LayoutTemplate,
  KeyRound,
  ListTodo,
  Receipt,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
/* eslint-enable no-restricted-imports */

export type AccentEntity =
  | 'lead'
  | 'company'
  | 'contact'
  | 'user'
  | 'project'
  | 'task'
  | 'timeLog'
  | 'client'
  | 'invoice'
  | 'hourBlock'
  | 'submission'
  | 'template'

export type EntityGroup = 'sales' | 'work' | 'money' | 'admin'

export const ENTITY_GROUP_LABELS: Record<EntityGroup, string> = {
  sales: 'Sales',
  work: 'Work',
  money: 'Money',
  admin: 'Admin',
}

type EntityAccent = {
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
  /** A filled badge (activity verbs): soft fill, accent text. */
  badge: string
}

export type EntityDefinition = {
  /** UI name. The person record is a "Person", a user is a "Sign-in". */
  label: string
  group: EntityGroup
  icon: LucideIcon
  /** The icon's lucide name, for docs and /design. */
  iconName: string
  /** Its colour token: `--entity-<token>` in theme.css. */
  token: string
  /** A sample record name for /design. */
  example: string
  accent: EntityAccent
}

export const ENTITIES: Record<AccentEntity, EntityDefinition> = {
  lead: {
    label: 'Lead',
    group: 'sales',
    icon: Handshake,
    iconName: 'Handshake',
    token: 'lead',
    example: 'Northwind redesign',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-lead/60',
      card: 'border-entity-lead/35 hover:border-entity-lead/60 hover:bg-entity-lead/5 hover:shadow-md',
      cardStatic: 'border-entity-lead/35',
      icon: 'text-entity-lead',
      tint: 'bg-entity-lead/10',
      badge: 'border-transparent bg-entity-lead/15 text-entity-lead',
    },
  },
  company: {
    label: 'Company',
    group: 'sales',
    icon: Building2,
    iconName: 'Building2',
    token: 'company',
    example: 'Acme Industries',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-company/60',
      card: 'border-entity-company/35 hover:border-entity-company/60 hover:bg-entity-company/5 hover:shadow-md',
      cardStatic: 'border-entity-company/35',
      icon: 'text-entity-company',
      tint: 'bg-entity-company/10',
      badge: 'border-transparent bg-entity-company/15 text-entity-company',
    },
  },
  contact: {
    label: 'Person',
    group: 'sales',
    icon: UserRound,
    iconName: 'UserRound',
    token: 'person',
    example: 'Ada Lovelace',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-person/60',
      card: 'border-entity-person/35 hover:border-entity-person/60 hover:bg-entity-person/5 hover:shadow-md',
      cardStatic: 'border-entity-person/35',
      icon: 'text-entity-person',
      tint: 'bg-entity-person/10',
      badge: 'border-transparent bg-entity-person/15 text-entity-person',
    },
  },
  user: {
    label: 'Sign-in',
    group: 'sales',
    icon: KeyRound,
    iconName: 'KeyRound',
    token: 'sign-in',
    example: 'ada@acme.com',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-sign-in/60',
      card: 'border-entity-sign-in/35 hover:border-entity-sign-in/60 hover:bg-entity-sign-in/5 hover:shadow-md',
      cardStatic: 'border-entity-sign-in/35',
      icon: 'text-entity-sign-in',
      tint: 'bg-entity-sign-in/10',
      badge: 'border-transparent bg-entity-sign-in/15 text-entity-sign-in',
    },
  },
  project: {
    label: 'Project',
    group: 'work',
    icon: FolderKanban,
    iconName: 'FolderKanban',
    token: 'project',
    example: 'Website rebuild',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-project/60',
      card: 'border-entity-project/35 hover:border-entity-project/60 hover:bg-entity-project/5 hover:shadow-md',
      cardStatic: 'border-entity-project/35',
      icon: 'text-entity-project',
      tint: 'bg-entity-project/10',
      badge: 'border-transparent bg-entity-project/15 text-entity-project',
    },
  },
  task: {
    label: 'Task',
    group: 'work',
    icon: ListTodo,
    iconName: 'ListTodo',
    token: 'task',
    example: 'Ship pricing page',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-task/60',
      card: 'border-entity-task/35 hover:border-entity-task/60 hover:bg-entity-task/5 hover:shadow-md',
      cardStatic: 'border-entity-task/35',
      icon: 'text-entity-task',
      tint: 'bg-entity-task/10',
      badge: 'border-transparent bg-entity-task/15 text-entity-task',
    },
  },
  timeLog: {
    label: 'Time log',
    group: 'work',
    icon: Clock,
    iconName: 'Clock',
    token: 'time-log',
    example: '2.5 hrs on pricing page',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-time-log/60',
      card: 'border-entity-time-log/35 hover:border-entity-time-log/60 hover:bg-entity-time-log/5 hover:shadow-md',
      cardStatic: 'border-entity-time-log/35',
      icon: 'text-entity-time-log',
      tint: 'bg-entity-time-log/10',
      badge: 'border-transparent bg-entity-time-log/15 text-entity-time-log',
    },
  },
  client: {
    label: 'Client',
    group: 'money',
    icon: Briefcase,
    iconName: 'Briefcase',
    token: 'client',
    example: 'Acme Industries',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-client/60',
      card: 'border-entity-client/35 hover:border-entity-client/60 hover:bg-entity-client/5 hover:shadow-md',
      cardStatic: 'border-entity-client/35',
      icon: 'text-entity-client',
      tint: 'bg-entity-client/10',
      badge: 'border-transparent bg-entity-client/15 text-entity-client',
    },
  },
  invoice: {
    label: 'Invoice',
    group: 'money',
    icon: Receipt,
    iconName: 'Receipt',
    token: 'invoice',
    example: 'INV-0142',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-invoice/60',
      card: 'border-entity-invoice/35 hover:border-entity-invoice/60 hover:bg-entity-invoice/5 hover:shadow-md',
      cardStatic: 'border-entity-invoice/35',
      icon: 'text-entity-invoice',
      tint: 'bg-entity-invoice/10',
      badge: 'border-transparent bg-entity-invoice/15 text-entity-invoice',
    },
  },
  hourBlock: {
    label: 'Hour block',
    group: 'money',
    icon: Hourglass,
    iconName: 'Hourglass',
    token: 'hour-block',
    example: '40 hours, prepaid',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-hour-block/60',
      card: 'border-entity-hour-block/35 hover:border-entity-hour-block/60 hover:bg-entity-hour-block/5 hover:shadow-md',
      cardStatic: 'border-entity-hour-block/35',
      icon: 'text-entity-hour-block',
      tint: 'bg-entity-hour-block/10',
      badge:
        'border-transparent bg-entity-hour-block/15 text-entity-hour-block',
    },
  },
  submission: {
    label: 'Submission',
    group: 'admin',
    icon: Inbox,
    iconName: 'Inbox',
    token: 'submission',
    example: 'Contact form',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-submission/60',
      card: 'border-entity-submission/35 hover:border-entity-submission/60 hover:bg-entity-submission/5 hover:shadow-md',
      cardStatic: 'border-entity-submission/35',
      icon: 'text-entity-submission',
      tint: 'bg-entity-submission/10',
      badge:
        'border-transparent bg-entity-submission/15 text-entity-submission',
    },
  },
  template: {
    label: 'Template',
    group: 'admin',
    icon: LayoutTemplate,
    iconName: 'LayoutTemplate',
    token: 'template',
    example: 'Invoice email',
    accent: {
      sheetHeader: 'border-b-2 border-b-entity-template/60',
      card: 'border-entity-template/35 hover:border-entity-template/60 hover:bg-entity-template/5 hover:shadow-md',
      cardStatic: 'border-entity-template/35',
      icon: 'text-entity-template',
      tint: 'bg-entity-template/10',
      badge: 'border-transparent bg-entity-template/15 text-entity-template',
    },
  },
}

/** Registry order: grouped by job, as /design and the docs list them. */
export const ENTITY_KEYS = Object.keys(ENTITIES) as AccentEntity[]

/** Each entity's accent classes. */
export const ENTITY_ACCENTS = Object.fromEntries(
  ENTITY_KEYS.map(key => [key, ENTITIES[key].accent])
) as Record<AccentEntity, EntityAccent>

/** Each entity's icon: use these instead of importing from lucide-react. */
export const ENTITY_ICONS = Object.fromEntries(
  ENTITY_KEYS.map(key => [key, ENTITIES[key].icon])
) as Record<AccentEntity, LucideIcon>

const ENTITY_BY_ICON = new Map<unknown, AccentEntity>(
  ENTITY_KEYS.map(key => [ENTITIES[key].icon, key])
)

/** The accent icon class for an entity's icon, or null for other icons. */
export function entityIconAccent(icon: unknown): string | null {
  const entity = ENTITY_BY_ICON.get(icon)
  return entity ? ENTITIES[entity].accent.icon : null
}
