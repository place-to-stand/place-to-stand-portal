'use client'

import { useState, type CSSProperties } from 'react'
import { Check, X } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { ClientBadge } from '@/components/clients/client-badge'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

import {
  CONTRAST_TARGET,
  ENTITIES,
  ENTITY_GROUP_LABELS,
  entityColour,
  entityContrast,
  type EntityGroup,
  type PaletteId,
} from './palettes'
import { DesignSection, Specimen } from './specimen'

const PALETTES: Array<{ id: PaletteId; label: string; about: string }> = [
  {
    id: 'current',
    label: 'A · Current',
    about:
      'What ships today (lib/entity-accents.ts): eleven Tailwind 500 hues, the same step in both themes.',
  },
  {
    id: 'grouped',
    label: 'B · Grouped by job',
    about:
      'Four hue families by job: sales warm, work green, money blue, admin neutral. Entities in a family differ by hue and shade; each theme gets its own step (darker in light, lighter in dark).',
  },
  {
    id: 'muted',
    label: 'C · Muted',
    about:
      'B’s assignments at 55% of the chroma: quieter tints that still keep the families apart. Preview only.',
  },
]

const GROUP_ORDER: EntityGroup[] = ['sales', 'work', 'money', 'admin']

export function FoundationsEntities() {
  const [palette, setPalette] = useState<PaletteId>('current')

  return (
    <DesignSection
      id='entities'
      title='Entity palette'
      when='Object identity: each kind of record keeps one icon and one accent everywhere it appears (sheet header rule, card border, list icon, badge). Colour is a second cue; the icon and the name carry the meaning.'
    >
      <Specimen
        label='Entities'
        note='Live classes from lib/entity-accents.ts; icons from the sidebar'
        className='grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4'
      >
        {ENTITIES.map(entity => {
          const Icon = entity.icon
          return (
            <div key={entity.key} className='flex min-w-0 items-center gap-3'>
              <span
                className={cn(
                  'bg-card flex size-9 shrink-0 items-center justify-center rounded-lg border',
                  ENTITY_ACCENTS[entity.key].cardStatic
                )}
              >
                <Icon
                  className={cn('size-4', ENTITY_ACCENTS[entity.key].icon)}
                  aria-hidden
                />
              </span>
              <span className='min-w-0'>
                <span className='block truncate text-sm font-medium'>
                  {entity.label}
                </span>
                <span className='text-muted-foreground block truncate font-mono text-[11px]'>
                  {entity.iconName}
                  {entity.key === 'client' ? ' · a company state' : ''}
                </span>
              </span>
            </div>
          )
        })}
      </Specimen>

      <Tabs
        value={palette}
        onValueChange={value => setPalette(value as PaletteId)}
        className='gap-5'
      >
        <div className='overflow-x-auto border-b'>
          <TabsList variant='line' aria-label='Candidate palettes'>
            {PALETTES.map(option => (
              <TabsTrigger key={option.id} value={option.id}>
                {option.label}
                <FailCount palette={option.id} />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {PALETTES.map(option => (
          <TabsContent key={option.id} value={option.id} className='space-y-4'>
            <p className='text-muted-foreground max-w-3xl text-sm'>
              {option.about}{' '}
              {option.id === 'current'
                ? ''
                : 'This is a preview: nothing outside this page changes.'}
            </p>
            <PaletteGrid palette={option.id} />
          </TabsContent>
        ))}
      </Tabs>
    </DesignSection>
  )
}

function FailCount({ palette }: { palette: PaletteId }) {
  const fails = ENTITIES.reduce((count, entity) => {
    const contrast = entityContrast(entityColour(palette, entity.key))
    return (
      count +
      (contrast.light < CONTRAST_TARGET ? 1 : 0) +
      (contrast.dark < CONTRAST_TARGET ? 1 : 0)
    )
  }, 0)
  return (
    <span
      className={cn(
        'rounded-full px-1.5 text-[10px] leading-4 font-semibold tabular-nums',
        fails
          ? 'bg-destructive/10 text-destructive'
          : 'bg-success/10 text-success'
      )}
      aria-label={fails ? `${fails} contrast failures` : 'All pass'}
    >
      {fails ? `${fails} fail` : 'pass'}
    </span>
  )
}

function PaletteGrid({ palette }: { palette: PaletteId }) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <div className='bg-muted/40 text-muted-foreground hidden grid-cols-[12rem_1fr_1fr] border-b text-xs font-medium md:grid'>
        <div className='px-4 py-2'>Entity</div>
        <div className='border-l px-4 py-2'>Light</div>
        <div className='border-l px-4 py-2'>Dark</div>
      </div>
      {GROUP_ORDER.map(group => (
        <div key={group}>
          <div className='bg-muted/40 text-muted-foreground border-b px-4 py-1.5 text-[11px] font-semibold tracking-wider uppercase'>
            {ENTITY_GROUP_LABELS[group]}
          </div>
          {ENTITIES.filter(entity => entity.group === group).map(entity => {
            const colour = entityColour(palette, entity.key)
            const contrast = entityContrast(colour)
            return (
              <div
                key={entity.key}
                className='grid grid-cols-1 border-b last:border-b-0 md:grid-cols-[12rem_1fr_1fr]'
              >
                <div className='flex flex-col justify-center gap-0.5 px-4 py-3'>
                  <span className='text-sm font-medium'>{entity.label}</span>
                  <span className='text-muted-foreground font-mono text-[11px]'>
                    {colour.label}
                  </span>
                </div>
                {/* email-paper pins the light tokens even in dark mode. */}
                <ThemeCell theme='light' ratio={contrast.light}>
                  <EntityPreview
                    palette={palette}
                    entity={entity}
                    colour={colour.light}
                  />
                </ThemeCell>
                <ThemeCell theme='dark' ratio={contrast.dark}>
                  <EntityPreview
                    palette={palette}
                    entity={entity}
                    colour={colour.dark}
                  />
                </ThemeCell>
              </div>
            )
          })}
        </div>
      ))}
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
 * A board-style card for the entity: the sheet header's accent rule, the
 * tinted border (hover it), and a badge in the ClientBadge recipe. Palette A
 * uses the live classes; B and C feed one colour through a CSS variable.
 */
function EntityPreview({
  palette,
  entity,
  colour,
}: {
  palette: PaletteId
  entity: (typeof ENTITIES)[number]
  colour: string
}) {
  const Icon = entity.icon
  const live = palette === 'current'
  const accent = ENTITY_ACCENTS[entity.key]
  const style = live ? undefined : ({ '--entity': colour } as CSSProperties)

  return (
    <div
      style={style}
      className={cn(
        'bg-card max-w-sm overflow-hidden rounded-lg border shadow-sm transition-all',
        live
          ? accent.card
          : 'border-[color-mix(in_oklch,var(--entity)_35%,transparent)] hover:border-[color-mix(in_oklch,var(--entity)_60%,transparent)] hover:bg-[color-mix(in_oklch,var(--entity)_5%,var(--card))] hover:shadow-md'
      )}
    >
      <div
        className={cn(
          'bg-muted/50 flex items-center gap-2 px-3 py-1.5',
          live
            ? accent.sheetHeader
            : 'border-b-2 border-b-[color-mix(in_oklch,var(--entity)_60%,transparent)]'
        )}
      >
        <Icon
          className={cn(
            'size-4 shrink-0',
            live ? accent.icon : 'text-(--entity)'
          )}
          aria-hidden
        />
        <span className='truncate text-sm font-medium'>{entity.sample}</span>
      </div>
      <div className='flex items-center gap-2 px-3 py-2'>
        {live && entity.key === 'client' ? (
          <ClientBadge />
        ) : (
          <Badge
            variant='outline'
            className={cn(
              'gap-1 text-xs font-normal',
              live
                ? accent.cardStatic
                : 'border-[color-mix(in_oklch,var(--entity)_35%,transparent)]'
            )}
          >
            <Icon
              className={cn('size-3', live ? accent.icon : 'text-(--entity)')}
            />
            {entity.label}
          </Badge>
        )}
        <span className='text-muted-foreground truncate text-xs'>
          Updated Sep 23, 2026
        </span>
      </div>
    </div>
  )
}
