'use client'

import { Copy } from 'lucide-react'

import { cn } from '@/lib/utils'

import { DesignSection, Specimen } from './specimen'
import { COLOR_TOKENS, darkValue, lightValue, type ColorToken } from './tokens'
import { useCopy } from './use-copy'

/** Token groups, by job. Names not listed fall into "Other". */
const GROUPS: Array<{ label: string; note: string; names: string[] }> = [
  {
    label: 'Surfaces',
    note: 'Grounds and raised panels. Build with these, never with raw greys.',
    names: ['background', 'card', 'popover', 'muted', 'secondary', 'accent'],
  },
  {
    label: 'Text',
    note: 'Ink for each surface. Pair a surface with its own foreground.',
    names: [
      'foreground',
      'muted-foreground',
      'card-foreground',
      'popover-foreground',
      'secondary-foreground',
      'accent-foreground',
    ],
  },
  {
    label: 'Lines and focus',
    note: 'Borders do the work; ring is the focus halo at 50%.',
    names: ['border', 'input', 'ring'],
  },
  {
    label: 'Action and status',
    note: 'Primary is ink, not a hue. Three status colours, and only three.',
    names: [
      'primary',
      'primary-foreground',
      'destructive',
      'success',
      'warning',
    ],
  },
  {
    label: 'Charts',
    note: 'Data series only. Hues change between themes, so never name a series by colour.',
    names: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'],
  },
  {
    label: 'Sidebar',
    note: 'The left navigation only.',
    names: [
      'sidebar',
      'sidebar-foreground',
      'sidebar-primary',
      'sidebar-primary-foreground',
      'sidebar-accent',
      'sidebar-accent-foreground',
      'sidebar-border',
      'sidebar-ring',
    ],
  },
  {
    label: 'Brand',
    note: 'Signed-out screens, share pages and the logo. Lime only on dark grounds.',
    names: COLOR_TOKENS.filter(t => t.name.startsWith('brand-')).map(
      t => t.name
    ),
  },
  {
    label: 'Email',
    note: 'Email templates and the email-paper preview.',
    names: COLOR_TOKENS.filter(t => t.name.startsWith('email-')).map(
      t => t.name
    ),
  },
]

const BY_NAME = new Map(COLOR_TOKENS.map(token => [token.name, token]))

// The two page grounds, so translucent tokens (border, input) read true.
const LIGHT_GROUND = lightValue(BY_NAME.get('background')?.value ?? '#fff')
const DARK_GROUND = darkValue(BY_NAME.get('background')?.value ?? '#000')

export function FoundationsColour() {
  return (
    <DesignSection
      id='colour'
      title='Colour tokens'
      when='Every colour in the UI comes from these semantic tokens, in a light and a dark theme. Click a swatch to copy its name, or a value to copy the value.'
    >
      {GROUPS.map(group => {
        const groupTokens = group.names
          .map(name => BY_NAME.get(name))
          .filter((token): token is ColorToken => Boolean(token))
        if (!groupTokens.length) return null
        return (
          <Specimen
            key={group.label}
            label={group.label}
            note={group.note}
            className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
          >
            {groupTokens.map(token => (
              <Swatch key={token.name} token={token} />
            ))}
          </Specimen>
        )
      })}
    </DesignSection>
  )
}

function Swatch({ token }: { token: ColorToken }) {
  const copy = useCopy()
  const light = lightValue(token.value)
  const dark = darkValue(token.value)
  const themed = light !== dark

  return (
    <div className='group flex min-w-0 flex-col overflow-hidden rounded-lg border'>
      <button
        type='button'
        onClick={() => copy(token.name)}
        aria-label={`Copy ${token.name}`}
        className='focus-visible:ring-ring/50 relative flex h-16 outline-none focus-visible:ring-[3px] focus-visible:ring-inset'
      >
        <span className='flex-1' style={{ background: LIGHT_GROUND }}>
          <span className='block size-full' style={{ background: light }} />
        </span>
        {themed ? (
          <span className='flex-1' style={{ background: DARK_GROUND }}>
            <span className='block size-full' style={{ background: dark }} />
          </span>
        ) : null}
        <span className='bg-background/90 text-foreground absolute top-2 right-2 rounded-md border p-1 opacity-0 shadow-xs transition-opacity group-hover:opacity-100'>
          <Copy className='size-3.5' aria-hidden />
        </span>
      </button>
      <div className='flex min-w-0 flex-1 flex-col gap-1.5 border-t p-3'>
        <p className='font-mono text-xs font-medium'>{token.name}</p>
        <div className='flex flex-col gap-0.5'>
          <ValueButton label={themed ? 'Light' : 'Both'} value={light} />
          {themed ? <ValueButton label='Dark' value={dark} /> : null}
        </div>
        <p className='text-muted-foreground line-clamp-3 text-xs leading-relaxed'>
          {token.usage}
        </p>
      </div>
    </div>
  )
}

function ValueButton({ label, value }: { label: string; value: string }) {
  const copy = useCopy()
  return (
    <button
      type='button'
      onClick={() => copy(value)}
      className={cn(
        'text-muted-foreground hover:text-foreground flex min-w-0 items-baseline gap-2 text-left font-mono text-[11px] transition-colors'
      )}
    >
      <span className='w-9 shrink-0 font-sans text-[10px] tracking-wide uppercase'>
        {label}
      </span>
      <span className='truncate'>{value}</span>
    </button>
  )
}
