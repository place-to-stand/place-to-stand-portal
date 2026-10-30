'use client'

import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  GripVertical,
  Info,
  Link2,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Trash2,
  TriangleAlert,
  Undo2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

import { ENTITIES } from './palettes'
import { DesignSection, Specimen } from './specimen'
import { useCopy } from './use-copy'

/** The glyphs the app imports most (counted from lucide imports). */
const COMMON: Array<[string, LucideIcon]> = [
  ['Plus', Plus],
  ['Loader2', Loader2],
  ['X', X],
  ['Check', Check],
  ['ChevronDown', ChevronDown],
  ['ChevronRight', ChevronRight],
  ['ChevronLeft', ChevronLeft],
  ['ChevronsUpDown', ChevronsUpDown],
  ['Pencil', Pencil],
  ['Trash2', Trash2],
  ['Archive', Archive],
  ['RefreshCw', RefreshCw],
  ['ExternalLink', ExternalLink],
  ['Link2', Link2],
  ['Info', Info],
  ['TriangleAlert', TriangleAlert],
  ['Lock', Lock],
  ['Eye', Eye],
  ['Mail', Mail],
  ['Send', Send],
  ['Clock', Clock],
  ['CalendarIcon', CalendarIcon],
  ['Search', Search],
  ['SlidersHorizontal', SlidersHorizontal],
  ['MoreHorizontal', MoreHorizontal],
  ['Undo2', Undo2],
  ['Redo2', Redo2],
  ['Star', Star],
  ['Paperclip', Paperclip],
  ['GripVertical', GripVertical],
  ['ArrowUp', ArrowUp],
  ['ArrowDown', ArrowDown],
  ['Users', Users],
  ['Copy', Copy],
]

export function FoundationsIcons() {
  const copy = useCopy()

  return (
    <DesignSection
      id='icons'
      title='Icons'
      when='lucide-react only: 2px stroke glyphs in currentColor. Buttons size them to 16px, badges to 12px, row actions to 14px, so never set a size inside those. Click an icon to copy its import name.'
    >
      <Specimen
        label='Entity icons'
        note='One icon per entity, tinted with its accent in lists'
        className='grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6'
      >
        {ENTITIES.map(entity => (
          <IconTile
            key={entity.key}
            name={entity.iconName}
            caption={entity.label}
            icon={entity.icon}
            iconClassName={ENTITY_ACCENTS[entity.key].icon}
            onCopy={copy}
          />
        ))}
      </Specimen>
      <Specimen
        label='Common glyphs'
        note='Muted in menus and select items; the label colour in buttons'
        className='grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8'
      >
        {COMMON.map(([name, icon]) => (
          <IconTile key={name} name={name} icon={icon} onCopy={copy} />
        ))}
      </Specimen>
    </DesignSection>
  )
}

function IconTile({
  name,
  caption,
  icon: Icon,
  iconClassName,
  onCopy,
}: {
  name: string
  caption?: string
  icon: LucideIcon
  iconClassName?: string
  onCopy: (value: string) => void
}) {
  return (
    <button
      type='button'
      onClick={() => onCopy(name)}
      aria-label={`Copy ${name}`}
      className='hover:bg-muted focus-visible:ring-ring/50 flex min-w-0 flex-col items-center gap-2 rounded-lg px-2 py-3 transition-colors outline-none focus-visible:ring-[3px]'
    >
      <Icon className={cn('size-5', iconClassName)} aria-hidden />
      <span className='w-full min-w-0 text-center'>
        {caption ? (
          <span className='block truncate text-xs font-medium'>{caption}</span>
        ) : null}
        <span className='text-muted-foreground block truncate font-mono text-[10px]'>
          {name}
        </span>
      </span>
    </button>
  )
}
