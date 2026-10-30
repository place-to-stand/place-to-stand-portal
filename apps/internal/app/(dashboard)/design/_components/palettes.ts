import {
  Briefcase,
  Building2,
  Clock3,
  FolderKanban,
  Handshake,
  Inbox,
  KeyRound,
  ListTodo,
  Mail,
  Receipt,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { ENTITY_ACCENTS, type AccentEntity } from '@/lib/entity-accents'

/**
 * Entity palette previews for /design. Palette A is read from
 * lib/entity-accents.ts (the live one); B and C are proposals that exist only
 * on this page. Contrast is computed from OKLCH, so the pass/fail marks are
 * measured, not eyeballed.
 */

export type EntityGroup = 'sales' | 'work' | 'money' | 'admin'

export const ENTITY_GROUP_LABELS: Record<EntityGroup, string> = {
  sales: 'Sales',
  work: 'Work',
  money: 'Money',
  admin: 'Admin',
}

type EntityMeta = {
  key: AccentEntity
  /** UI name: the person record is a "Person", a user is a "Sign-in". */
  label: string
  icon: LucideIcon
  iconName: string
  group: EntityGroup
  /** A sample record name for the preview card. */
  sample: string
}

/**
 * Icons follow ENTITY_BY_ICON (lib/entity-accents.ts) and the sidebar
 * (navigation-config.ts). Suggestion and sign-in have no icon in the app
 * yet; Sparkles and KeyRound stand in here.
 */
export const ENTITIES: EntityMeta[] = [
  {
    key: 'lead',
    label: 'Lead',
    icon: Handshake,
    iconName: 'Handshake',
    group: 'sales',
    sample: 'Northwind redesign',
  },
  {
    key: 'company',
    label: 'Company',
    icon: Building2,
    iconName: 'Building2',
    group: 'sales',
    sample: 'Acme Industries',
  },
  {
    key: 'contact',
    label: 'Person',
    icon: UserRound,
    iconName: 'UserRound',
    group: 'sales',
    sample: 'Ada Lovelace',
  },
  {
    key: 'user',
    label: 'Sign-in',
    icon: KeyRound,
    iconName: 'KeyRound',
    group: 'sales',
    sample: 'ada@acme.com',
  },
  {
    key: 'project',
    label: 'Project',
    icon: FolderKanban,
    iconName: 'FolderKanban',
    group: 'work',
    sample: 'Website rebuild',
  },
  {
    key: 'task',
    label: 'Task',
    icon: ListTodo,
    iconName: 'ListTodo',
    group: 'work',
    sample: 'Ship pricing page',
  },
  {
    key: 'suggestion',
    label: 'Suggestion',
    icon: Sparkles,
    iconName: 'Sparkles',
    group: 'work',
    sample: 'Add uptime alerts',
  },
  {
    key: 'client',
    label: 'Client',
    icon: Briefcase,
    iconName: 'Briefcase',
    group: 'money',
    sample: 'Acme Industries',
  },
  {
    key: 'invoice',
    label: 'Invoice',
    icon: Receipt,
    iconName: 'Receipt',
    group: 'money',
    sample: 'INV-0142',
  },
  {
    key: 'hourBlock',
    label: 'Hour block',
    icon: Clock3,
    iconName: 'Clock3',
    group: 'money',
    sample: '40 hours, prepaid',
  },
  {
    key: 'submission',
    label: 'Submission',
    icon: Inbox,
    iconName: 'Inbox',
    group: 'admin',
    sample: 'Contact form',
  },
  {
    key: 'template',
    label: 'Template',
    icon: Mail,
    iconName: 'Mail',
    group: 'admin',
    sample: 'Invoice email',
  },
]

/** Tailwind v4's OKLCH values for the steps the palettes use (L 0–1, C, H). */
const TW: Record<string, [number, number, number]> = {
  'violet-500': [0.606, 0.25, 292.717],
  'amber-300': [0.879, 0.169, 91.605],
  'amber-500': [0.769, 0.188, 70.08],
  'amber-600': [0.666, 0.179, 58.318],
  'emerald-400': [0.765, 0.177, 163.223],
  'emerald-500': [0.696, 0.17, 162.48],
  'emerald-600': [0.596, 0.145, 163.225],
  'blue-400': [0.707, 0.165, 254.624],
  'blue-500': [0.623, 0.214, 259.815],
  'blue-600': [0.546, 0.245, 262.881],
  'rose-300': [0.81, 0.117, 11.638],
  'rose-400': [0.712, 0.194, 13.428],
  'rose-500': [0.645, 0.246, 16.439],
  'rose-600': [0.586, 0.253, 17.585],
  'rose-800': [0.455, 0.188, 13.697],
  'indigo-300': [0.785, 0.115, 274.713],
  'indigo-500': [0.585, 0.233, 277.117],
  'fuchsia-500': [0.667, 0.295, 322.15],
  'orange-400': [0.75, 0.183, 55.934],
  'orange-500': [0.705, 0.213, 47.604],
  'orange-700': [0.553, 0.195, 38.402],
  'teal-300': [0.855, 0.138, 181.071],
  'teal-500': [0.704, 0.14, 182.503],
  'teal-700': [0.511, 0.096, 186.391],
  'pink-500': [0.656, 0.241, 354.308],
  'slate-400': [0.704, 0.04, 256.788],
  'slate-500': [0.554, 0.046, 257.417],
  'stone-300': [0.869, 0.005, 56.366],
  'stone-600': [0.444, 0.011, 73.639],
  'sky-300': [0.828, 0.111, 230.318],
  'sky-700': [0.5, 0.134, 242.749],
  'lime-400': [0.841, 0.238, 128.85],
  'lime-700': [0.532, 0.157, 131.589],
}

export type PaletteId = 'current' | 'grouped' | 'muted'

export type EntityColour = {
  /** CSS colour for the icon (and, mixed down, the border and tint). */
  light: string
  dark: string
  /** Human label: "amber-600 / amber-300". */
  label: string
  lightOklch: [number, number, number]
  darkOklch: [number, number, number]
}

/** "Grouped by job": [light step, dark step] per entity. */
const GROUPED_STEPS: Record<AccentEntity, [string, string]> = {
  lead: ['amber-600', 'amber-300'],
  company: ['orange-700', 'orange-400'],
  contact: ['rose-600', 'rose-400'],
  user: ['rose-800', 'rose-300'],
  project: ['emerald-600', 'emerald-400'],
  task: ['teal-700', 'teal-300'],
  suggestion: ['lime-700', 'lime-400'],
  client: ['blue-600', 'blue-400'],
  invoice: ['sky-700', 'sky-300'],
  hourBlock: ['indigo-500', 'indigo-300'],
  submission: ['slate-500', 'slate-400'],
  template: ['stone-600', 'stone-300'],
}

/** "Muted" keeps B's assignments at a bit over half the chroma. */
const MUTED_CHROMA = 0.55

const css = ([l, c, h]: [number, number, number]) =>
  `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`

function step(name: string): [number, number, number] {
  const value = TW[name]
  if (!value) throw new Error(`Missing Tailwind step ${name}`)
  return value
}

/** The live accent's step, parsed from its `text-<hue>-<step>` icon class. */
function currentStep(entity: AccentEntity) {
  const match = ENTITY_ACCENTS[entity].icon.match(/text-([a-z]+-\d+)/)
  return match?.[1] ?? 'slate-500'
}

export function entityColour(
  palette: PaletteId,
  entity: AccentEntity
): EntityColour {
  if (palette === 'current') {
    const name = currentStep(entity)
    const value = step(name)
    return {
      light: css(value),
      dark: css(value),
      label: `${name} (both themes)`,
      lightOklch: value,
      darkOklch: value,
    }
  }
  const [lightName, darkName] = GROUPED_STEPS[entity]
  const scale = palette === 'muted' ? MUTED_CHROMA : 1
  const light = step(lightName)
  const dark = step(darkName)
  const lightOklch: [number, number, number] = [
    light[0],
    light[1] * scale,
    light[2],
  ]
  const darkOklch: [number, number, number] = [
    dark[0],
    dark[1] * scale,
    dark[2],
  ]
  return {
    light: css(lightOklch),
    dark: css(darkOklch),
    label:
      palette === 'muted'
        ? `${lightName} / ${darkName} at ${Math.round(MUTED_CHROMA * 100)}% chroma`
        : `${lightName} / ${darkName}`,
    lightOklch,
    darkOklch,
  }
}

// --- Contrast (WCAG 2.x) ----------------------------------------------------

/** Relative luminance of an OKLCH colour, clipped to sRGB. */
function luminance([l, c, h]: [number, number, number]) {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clip = (x: number) => Math.min(1, Math.max(0, x))
  const r = clip(4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp)
  const g = clip(-1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp)
  const bl = clip(-0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

/** `--card` in each theme (theme.css): white, and oklch(0.205 0 0). */
export const CARD_LIGHT: [number, number, number] = [1, 0, 0]
export const CARD_DARK: [number, number, number] = [0.205, 0, 0]

/** Non-text (icon) contrast target, WCAG 1.4.11. */
export const CONTRAST_TARGET = 3

export function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number]
) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export type ContrastResult = { light: number; dark: number }

export function entityContrast(colour: EntityColour): ContrastResult {
  return {
    light: contrastRatio(colour.lightOklch, CARD_LIGHT),
    dark: contrastRatio(colour.darkOklch, CARD_DARK),
  }
}
