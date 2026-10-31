'use client'

import { Check, X } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import {
  ENTITIES,
  ENTITY_GROUP_LABELS,
  ENTITY_KEYS,
  type AccentEntity,
  type EntityGroup,
} from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

import { CONTRAST_TARGET, entityColour } from './entity-contrast'
import { DesignSection } from './specimen'

const GROUP_ORDER = Object.keys(ENTITY_GROUP_LABELS) as EntityGroup[]

/**
 * Every entity in the registry (lib/entity-accents.ts), grouped by job, with
 * its live colour token and icon-on-card contrast in each theme. Nothing here
 * is hand-listed: a new entity shows up on its own.
 */
export function FoundationsEntities() {
  return (
    <DesignSection
      id='entities'
      title='Entities'
      when='Object identity: each kind of record keeps one icon and one colour everywhere it appears (sidebar, sheet header rule, card border, list icon, badge, activity). Both come from the entity registry, lib/entity-accents.ts; never import an entity icon from lucide-react or write its colour by hand. Colours group by job: sales warm, work blue, money green, admin neutral. Colour is a second cue: the icon and the name carry the meaning.'
    >
      <div className='overflow-hidden rounded-xl border'>
        <div className='bg-muted/40 text-muted-foreground hidden grid-cols-[13rem_1fr_1fr] border-b text-xs font-medium md:grid'>
          <div className='px-4 py-2'>Entity</div>
          <div className='border-l px-4 py-2'>Light</div>
          <div className='border-l px-4 py-2'>Dark</div>
        </div>
        {GROUP_ORDER.map(group => (
          <div key={group}>
            <div className='bg-muted/40 text-muted-foreground border-b px-4 py-1.5 text-[11px] font-semibold tracking-wider uppercase'>
              {ENTITY_GROUP_LABELS[group]}
            </div>
            {ENTITY_KEYS.filter(key => ENTITIES[key].group === group).map(
              key => (
                <EntityRow key={key} entity={key} />
              )
            )}
          </div>
        ))}
      </div>
    </DesignSection>
  )
}

function EntityRow({ entity }: { entity: AccentEntity }) {
  const definition = ENTITIES[entity]
  const colour = entityColour(entity)
  return (
    <div className='grid grid-cols-1 border-b last:border-b-0 md:grid-cols-[13rem_1fr_1fr]'>
      <div className='flex flex-col justify-center gap-0.5 px-4 py-3'>
        <span className='text-sm font-medium'>{definition.label}</span>
        <span className='text-muted-foreground font-mono text-[11px]'>
          {definition.iconName} · {colour.token}
        </span>
      </div>
      {/* email-paper pins the light tokens even in dark mode. */}
      <ThemeCell theme='light' ratio={colour.lightContrast}>
        <EntityPreview entity={entity} />
      </ThemeCell>
      <ThemeCell theme='dark' ratio={colour.darkContrast}>
        <EntityPreview entity={entity} />
      </ThemeCell>
    </div>
  )
}

function ThemeCell({
  theme,
  ratio,
  children,
}: {
  theme: 'light' | 'dark'
  ratio: number
  children: React.ReactNode
}) {
  const pass = ratio >= CONTRAST_TARGET
  return (
    <div
      className={cn(
        'bg-background text-foreground flex items-center gap-3 px-4 py-3 md:border-l',
        theme === 'dark' ? 'dark' : 'email-paper'
      )}
    >
      <div className='min-w-0 flex-1'>{children}</div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
          pass
            ? 'bg-success/10 text-success'
            : 'bg-destructive/10 text-destructive'
        )}
        title={`Icon on card, ${theme} theme`}
      >
        {pass ? (
          <Check className='size-3' aria-hidden />
        ) : (
          <X className='size-3' aria-hidden />
        )}
        {ratio.toFixed(1)}:1
        <span className='sr-only'>{pass ? 'passes' : 'fails'} 3:1</span>
      </span>
    </div>
  )
}

/**
 * A board-style card for the entity with its live classes: the sheet
 * header's accent rule, the tinted border (hover it), and a badge.
 */
function EntityPreview({ entity }: { entity: AccentEntity }) {
  const { icon: Icon, accent, label, example } = ENTITIES[entity]
  return (
    <div
      className={cn(
        'bg-card max-w-sm overflow-hidden rounded-lg border shadow-sm transition-all',
        accent.card
      )}
    >
      <div
        className={cn(
          'bg-muted/50 flex items-center gap-2 px-3 py-1.5',
          accent.sheetHeader
        )}
      >
        <Icon className={cn('size-4 shrink-0', accent.icon)} aria-hidden />
        <span className='truncate text-sm font-medium'>{example}</span>
      </div>
      <div className='flex items-center gap-2 px-3 py-2'>
        <Badge variant='outline' className={cn('gap-1', accent.cardStatic)}>
          <Icon className={cn('size-3', accent.icon)} />
          {label}
        </Badge>
        <span className='text-muted-foreground truncate text-xs'>
          Updated Sep 23, 2026
        </span>
      </div>
    </div>
  )
}
