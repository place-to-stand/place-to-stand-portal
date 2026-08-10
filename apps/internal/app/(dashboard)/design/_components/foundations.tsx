import { cn } from '@/lib/utils'

import { DesignSection, Specimen } from './specimen'

/** Color-token swatches for every color var in globals.css :root/.dark. */
const COLOR_TOKENS: Array<{ name: string; className: string }> = [
  { name: 'background', className: 'bg-background' },
  { name: 'foreground', className: 'bg-foreground' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'primary-foreground', className: 'bg-primary-foreground' },
  { name: 'secondary', className: 'bg-secondary' },
  { name: 'secondary-foreground', className: 'bg-secondary-foreground' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'muted-foreground', className: 'bg-muted-foreground' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'accent-foreground', className: 'bg-accent-foreground' },
  { name: 'destructive', className: 'bg-destructive' },
  { name: 'border', className: 'bg-border' },
  { name: 'input', className: 'bg-input' },
  { name: 'ring', className: 'bg-ring' },
  { name: 'card', className: 'bg-card' },
  { name: 'card-foreground', className: 'bg-card-foreground' },
  { name: 'popover', className: 'bg-popover' },
  { name: 'popover-foreground', className: 'bg-popover-foreground' },
  { name: 'chart-1', className: 'bg-chart-1' },
  { name: 'chart-2', className: 'bg-chart-2' },
  { name: 'chart-3', className: 'bg-chart-3' },
  { name: 'chart-4', className: 'bg-chart-4' },
  { name: 'chart-5', className: 'bg-chart-5' },
  { name: 'sidebar', className: 'bg-sidebar' },
  { name: 'sidebar-foreground', className: 'bg-sidebar-foreground' },
  { name: 'sidebar-primary', className: 'bg-sidebar-primary' },
  {
    name: 'sidebar-primary-foreground',
    className: 'bg-sidebar-primary-foreground',
  },
  { name: 'sidebar-accent', className: 'bg-sidebar-accent' },
  {
    name: 'sidebar-accent-foreground',
    className: 'bg-sidebar-accent-foreground',
  },
  { name: 'sidebar-border', className: 'bg-sidebar-border' },
  { name: 'sidebar-ring', className: 'bg-sidebar-ring' },
]

const RADII: Array<{ name: string; className: string }> = [
  { name: 'rounded-sm', className: 'rounded-sm' },
  { name: 'rounded-md', className: 'rounded-md' },
  { name: 'rounded-lg', className: 'rounded-lg' },
  { name: 'rounded-xl', className: 'rounded-xl' },
]

const TYPE_SCALE: Array<{ name: string; className: string }> = [
  { name: 'text-xs', className: 'text-xs' },
  { name: 'text-sm', className: 'text-sm' },
  { name: 'text-base', className: 'text-base' },
  { name: 'text-lg', className: 'text-lg' },
  { name: 'text-xl', className: 'text-xl' },
  { name: 'text-2xl', className: 'text-2xl' },
  { name: 'text-3xl', className: 'text-3xl' },
]

/**
 * Object-identity entity accents (docs/design-system.md). Class strings are
 * written out literally so Tailwind can see them.
 */
const ENTITY_CARDS: Array<{ name: string; color: string; className: string }> =
  [
    {
      name: 'Task',
      color: 'violet',
      className:
        'border-violet-500/35 hover:border-violet-500/60 hover:bg-violet-500/5',
    },
    {
      name: 'Lead',
      color: 'amber',
      className:
        'border-amber-500/35 hover:border-amber-500/60 hover:bg-amber-500/5',
    },
    {
      name: 'Project',
      color: 'emerald',
      className:
        'border-emerald-500/35 hover:border-emerald-500/60 hover:bg-emerald-500/5',
    },
    {
      name: 'Client',
      color: 'blue',
      className:
        'border-blue-500/35 hover:border-blue-500/60 hover:bg-blue-500/5',
    },
    {
      name: 'Contact',
      color: 'cyan',
      className:
        'border-cyan-500/35 hover:border-cyan-500/60 hover:bg-cyan-500/5',
    },
    {
      name: 'Suggestion',
      color: 'fuchsia',
      className:
        'border-fuchsia-500/35 hover:border-fuchsia-500/60 hover:bg-fuchsia-500/5',
    },
  ]

export function Foundations() {
  return (
    <DesignSection
      id='foundations'
      title='Foundations'
      description='Color tokens, radius scale, type scale, and object-identity accents. Swatches render in the current theme — flip the app theme to see the dark values.'
    >
      <Specimen label='Color tokens' className='gap-4'>
        {COLOR_TOKENS.map(token => (
          <div key={token.name} className='w-28 space-y-1.5'>
            <div
              className={cn('h-10 w-full rounded-md border', token.className)}
            />
            <p className='text-muted-foreground truncate font-mono text-[11px]'>
              --{token.name}
            </p>
          </div>
        ))}
      </Specimen>

      <Specimen label='Radius scale' note='--radius: 0.625rem'>
        {RADII.map(radius => (
          <div key={radius.name} className='space-y-1.5 text-center'>
            <div
              className={cn('bg-muted size-16 border', radius.className)}
            />
            <p className='text-muted-foreground font-mono text-[11px]'>
              {radius.name}
            </p>
          </div>
        ))}
      </Specimen>

      <Specimen label='Type scale' className='flex-col items-start gap-2'>
        {TYPE_SCALE.map(step => (
          <div key={step.name} className='flex items-baseline gap-4'>
            <span className='text-muted-foreground w-20 shrink-0 font-mono text-[11px]'>
              {step.name}
            </span>
            <span className={step.className}>
              The quick brown fox jumps over the lazy dog
            </span>
          </div>
        ))}
      </Specimen>

      <Specimen
        label='Object identity'
        note='entity accent cards — tinted border + hover tint (docs/design-system.md)'
        className='gap-4'
      >
        {ENTITY_CARDS.map(entity => (
          <div
            key={entity.name}
            className={cn(
              'bg-card w-44 rounded-lg border p-4 shadow-sm transition-all hover:shadow-md',
              entity.className
            )}
          >
            <p className='text-sm font-semibold'>{entity.name}</p>
            <p className='text-muted-foreground text-xs'>{entity.color}-500</p>
          </div>
        ))}
      </Specimen>
    </DesignSection>
  )
}
