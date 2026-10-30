import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'

import { Code, DesignSection, Specimen } from './specimen'
import {
  darkValue,
  lightValue,
  OPACITIES,
  RADII,
  SHADOWS,
  SIZES,
  SPACING,
  TYPE_GROUPS,
} from './tokens'

const FAMILY_VAR: Record<string, string> = {
  sans: 'var(--font-sans)',
  mono: 'var(--font-mono)',
  display: 'var(--font-display)',
}

export function FoundationsType() {
  return (
    <DesignSection
      id='type'
      title='Type'
      when='Geist at 14px is the working size for everything. Space Grotesk is the brand face, for the wordmark and signed-out headlines only. Geist Mono is for identifiers and keys.'
    >
      {TYPE_GROUPS.map(group => (
        <Specimen key={group.name} label={group.name} note={group.note} bleed>
          <ul className='divide-y'>
            {group.styles.map(style => (
              <li
                key={style.name}
                className='grid grid-cols-1 gap-2 px-5 py-4 sm:px-6 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,18rem)] md:items-baseline md:gap-6'
              >
                <div className='space-y-0.5'>
                  <p className='font-mono text-xs font-medium'>{style.name}</p>
                  <Code>
                    {style.fontSize} / {style.lineHeight} · {style.fontWeight}
                  </Code>
                </div>
                <p
                  className='min-w-0 truncate'
                  style={
                    {
                      fontFamily: FAMILY_VAR[group.family] ?? undefined,
                      fontSize: style.fontSize,
                      lineHeight: style.lineHeight,
                      fontWeight: style.fontWeight,
                      letterSpacing: style.letterSpacing,
                      textTransform: style.textTransform,
                    } as CSSProperties
                  }
                >
                  {style.sample}
                </p>
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  {style.usage}
                </p>
              </li>
            ))}
          </ul>
        </Specimen>
      ))}
    </DesignSection>
  )
}

export function FoundationsSpace() {
  return (
    <DesignSection
      id='space'
      title='Spacing and size'
      when='Tailwind’s 4px scale, used as written. Controls on one row share one height; pick a size prop instead of overriding h-*.'
    >
      <Specimen label='Spacing' note={SPACING.note} bleed>
        <ul className='divide-y'>
          {SPACING.tokens.map(token => (
            <li
              key={token.name}
              className='grid grid-cols-[6rem_4rem_minmax(0,1fr)] items-center gap-4 px-5 py-3 sm:px-6 md:grid-cols-[7rem_10rem_minmax(0,1fr)]'
            >
              <span className='font-mono text-xs font-medium'>
                {token.name}
              </span>
              <span className='flex items-center gap-2'>
                <span
                  className='bg-foreground/70 block h-3 rounded-[2px]'
                  style={{ width: lightValue(token.value) }}
                />
                <Code>{lightValue(token.value)}</Code>
              </span>
              <span className='text-muted-foreground text-xs'>
                {token.usage}
              </span>
            </li>
          ))}
        </ul>
      </Specimen>

      <Specimen label='Control heights' note={SIZES.note} bleed>
        <ul className='divide-y'>
          {SIZES.tokens.map((token, index) => {
            const size = (['xs', 'sm', 'default', 'lg'] as const)[index]
            return (
              <li
                key={token.name}
                className='grid grid-cols-1 items-center gap-3 px-5 py-3 sm:px-6 md:grid-cols-[9rem_14rem_minmax(0,1fr)] md:gap-6'
              >
                <span className='space-y-0.5'>
                  <span className='block font-mono text-xs font-medium'>
                    {token.name}
                  </span>
                  <Code>{lightValue(token.value)}</Code>
                </span>
                <span className='flex items-center gap-2'>
                  {size ? (
                    <>
                      <Button size={size} variant='outline'>
                        <Plus />
                        Button
                      </Button>
                    </>
                  ) : null}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {token.usage}
                </span>
              </li>
            )
          })}
        </ul>
      </Specimen>
    </DesignSection>
  )
}

export function FoundationsRadius() {
  return (
    <DesignSection
      id='radius'
      title='Radius and shadow'
      when='One base radius (10px) with steps derived from it: smaller inside menus, larger on cards. Borders carry structure; shadows only lift what floats.'
    >
      <Specimen
        label='Radius'
        note={RADII.note}
        className='grid grid-cols-2 gap-6 sm:grid-cols-4 xl:grid-cols-7'
      >
        {RADII.tokens.map(token => (
          <div key={token.name} className='space-y-2'>
            <div
              className='bg-muted border-foreground/20 size-16 border-2'
              style={{ borderRadius: lightValue(token.value) }}
            />
            <p className='font-mono text-xs font-medium'>{token.name}</p>
            <Code>{lightValue(token.value)}</Code>
            <p className='text-muted-foreground text-xs'>{token.usage}</p>
          </div>
        ))}
      </Specimen>

      <Specimen
        label='Shadow'
        note={SHADOWS.note}
        className='bg-muted/40 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5'
      >
        {SHADOWS.tokens.map(token => {
          const isFocus = token.name === 'focus-ring'
          return (
            <div key={token.name} className='space-y-3'>
              <div
                className='bg-card h-20 rounded-lg border'
                style={{
                  boxShadow: isFocus ? undefined : lightValue(token.value),
                }}
              >
                {isFocus ? (
                  <div className='flex h-full items-center justify-center'>
                    <span className='border-ring ring-ring/50 rounded-md border px-3 py-1.5 text-sm ring-[3px]'>
                      Focused
                    </span>
                  </div>
                ) : null}
              </div>
              <p className='font-mono text-xs font-medium'>{token.name}</p>
              <p className='text-muted-foreground text-xs'>{token.usage}</p>
              {typeof token.value !== 'string' ? (
                <Code>
                  {lightValue(token.value)} · dark {darkValue(token.value)}
                </Code>
              ) : null}
            </div>
          )
        })}
      </Specimen>

      <Specimen
        label='Opacity'
        className='grid grid-cols-1 gap-6 sm:grid-cols-3'
      >
        {OPACITIES.tokens.map(token => (
          <div key={token.name} className='flex items-center gap-3'>
            <span className='relative size-12 shrink-0 overflow-hidden rounded-md border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--background)_0_50%)] bg-[length:12px_12px]'>
              <span
                className='absolute inset-0 bg-black'
                style={{ opacity: Number(lightValue(token.value)) }}
              />
            </span>
            <span className='min-w-0 space-y-0.5'>
              <span className='block font-mono text-xs font-medium'>
                {token.name} · {lightValue(token.value)}
              </span>
              <span className='text-muted-foreground block text-xs'>
                {token.usage}
              </span>
            </span>
          </div>
        ))}
      </Specimen>
    </DesignSection>
  )
}
