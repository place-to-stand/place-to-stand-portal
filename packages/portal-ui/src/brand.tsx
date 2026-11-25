import type { CSSProperties } from 'react'

import { cn } from '@placetostand/ui/cn'

/**
 * Place To Stand brand marks, matching the marketing site.
 *
 * `BrandLogo` is the marketing header lockup: the blueprint mark (an
 * accent-bordered square holding an accent dot) beside the business name in
 * Space Grotesk. Every logo in both portals is this lockup — the signed-in
 * headers, the public share pages, and the auth screens. The "PTS" tile with
 * corner brackets is the favicon only (see `brand-icon-assets.ts`).
 *
 * The wordmark reads `--font-space-grotesk`, which both apps' root layouts
 * load.
 */

/** Marketing brand tokens — see the marketing site's globals.css. */
export const BRAND = {
  bg: '#0e0f11',
  bgCard: '#1a1b1f',
  bgPanel: 'rgba(22, 24, 28, 0.88)',
  border: '#2a2b30',
  borderLight: '#3a3b40',
  text: '#e8e6e3',
  textMuted: '#a8a8ac',
  accent: '#b5f542',
  gridDot: '#2a2b30',
} as const

/** 24px dot grid, phased to match the marketing site's body background. */
export const BRAND_DOT_GRID: CSSProperties = {
  backgroundImage: `radial-gradient(circle, ${BRAND.gridDot} 1px, transparent 1px)`,
  backgroundSize: '24px 24px',
  backgroundPosition: '50% 12px',
}

/**
 * The marketing site's registration marks: accent brackets on the top-left
 * and bottom-right corners of a card. The parent must be `relative`; pass the
 * bracket colour as a border-colour class.
 */
export function BlueprintCorners({
  size = 12,
  className,
}: {
  size?: number
  className?: string
}) {
  const style = { width: size, height: size }

  return (
    <>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-px -left-px z-10 border-t border-l',
          className
        )}
        style={style}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-px -bottom-px z-10 border-r border-b',
          className
        )}
        style={style}
      />
    </>
  )
}

/**
 * `theme` follows the portal's light/dark theme. The brand lime (#b5f542)
 * is built for the dark marketing ground and all but vanishes on white, so
 * light mode swaps in lime-600 for the mark. `brand` pins the dark marketing
 * colours, for the always-dark auth screens.
 */
type BrandTone = 'theme' | 'brand'

/** The name every install starts with; the blueprint mark belongs to it. */
export const DEFAULT_BRAND_NAME = 'Place To Stand'

const TONE_CLASSES: Record<
  BrandTone,
  { frame: string; dot: string; word: string }
> = {
  theme: {
    frame: 'border-brand-lime-600/60 dark:border-brand-lime/50',
    dot: 'bg-brand-lime-600 dark:bg-brand-lime',
    word: 'text-foreground',
  },
  brand: {
    frame: 'border-brand-lime/50',
    dot: 'bg-brand-lime',
    word: 'text-brand-text',
  },
}

/**
 * The blueprint mark on its own — for spaces too tight for the wordmark
 * (the collapsed sidebar). Proportions follow the marketing header (24px
 * square, 8px dot, 1px frame) and share card (36px, 12px dot, 2px frame).
 */
export function BrandLogoMark({
  size = 24,
  tone = 'theme',
  className,
  iconSrc,
  name = DEFAULT_BRAND_NAME,
}: {
  size?: number
  tone?: BrandTone
  className?: string
  /** The business's uploaded icon (Settings → Business), in place of the mark. */
  iconSrc?: string | null
  /**
   * The business name. Another business with no icon gets its first letter
   * in the frame: the blueprint mark belongs to Place To Stand.
   */
  name?: string
}) {
  if (iconSrc) {
    return (
      // A data or same-origin route URL of unknown size: next/image adds nothing here.
      <img
        src={iconSrc}
        alt=''
        aria-hidden
        width={size}
        height={size}
        className={cn('shrink-0 object-contain', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  const dot = Math.round(size / 3)

  if (name !== DEFAULT_BRAND_NAME) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-sm border leading-none font-bold',
          TONE_CLASSES[tone].frame,
          TONE_CLASSES[tone].word,
          className
        )}
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.6),
          fontFamily: 'var(--font-space-grotesk, inherit)',
        }}
      >
        {name.trim().charAt(0).toUpperCase() || '·'}
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center border',
        TONE_CLASSES[tone].frame,
        className
      )}
      style={{ width: size, height: size, borderWidth: size >= 32 ? 2 : 1 }}
    >
      <span
        className={TONE_CLASSES[tone].dot}
        style={{ width: dot, height: dot }}
      />
    </span>
  )
}

const LOGO_SIZES = {
  sm: { mark: 16, text: 'text-[15px]', gap: 'gap-2' },
  md: { mark: 20, text: 'text-lg', gap: 'gap-2.5' },
  lg: { mark: 24, text: 'text-xl', gap: 'gap-3' },
} as const

/**
 * Mark + wordmark, as in the marketing site header. `lg` is its exact size.
 * An install that set its own business shows its uploaded logo, or its icon
 * and name; the blueprint mark only ever stands beside Place To Stand.
 */
export function BrandLogo({
  size = 'md',
  tone = 'theme',
  className,
  name = DEFAULT_BRAND_NAME,
  logoSrc,
  iconSrc,
}: {
  size?: keyof typeof LOGO_SIZES
  tone?: BrandTone
  className?: string
  name?: string
  /** Uploaded logo (Settings → Business): replaces mark and wordmark. */
  logoSrc?: string | null
  iconSrc?: string | null
}) {
  const { mark, text, gap } = LOGO_SIZES[size]

  if (logoSrc) {
    return (
      <span className={cn('inline-flex items-center', className)}>
        <img
          src={logoSrc}
          alt={name}
          className='w-auto max-w-[200px] object-contain'
          style={{ height: mark + 8 }}
        />
      </span>
    )
  }

  const showMark = Boolean(iconSrc) || name === DEFAULT_BRAND_NAME

  return (
    <span className={cn('inline-flex items-center', gap, className)}>
      {showMark ? (
        <BrandLogoMark size={mark} tone={tone} iconSrc={iconSrc} name={name} />
      ) : null}
      <span
        className={cn(
          'leading-none font-bold tracking-tight whitespace-nowrap',
          text,
          TONE_CLASSES[tone].word
        )}
        style={{ fontFamily: 'var(--font-space-grotesk, inherit)' }}
      >
        {name}
      </span>
    </span>
  )
}

/**
 * Mark + wordmark + a mono micro-label naming which portal you are signing in
 * to. `label` is what distinguishes the two apps' screens from each other.
 */
export function BrandLockup({
  label,
  name = DEFAULT_BRAND_NAME,
  iconSrc,
}: {
  label: string
  name?: string
  iconSrc?: string | null
}) {
  const showMark = Boolean(iconSrc) || name === DEFAULT_BRAND_NAME
  return (
    <div className='flex flex-col items-center gap-4'>
      {showMark ? (
        <BrandLogoMark size={36} tone='brand' iconSrc={iconSrc} name={name} />
      ) : null}
      <div className='flex flex-col items-center gap-2'>
        <span
          className='text-xl font-bold tracking-tight'
          style={{
            color: BRAND.text,
            fontFamily: 'var(--font-space-grotesk, inherit)',
          }}
        >
          {name}
        </span>
        <span
          className='text-overline font-mono tracking-[0.1em] uppercase'
          style={{ color: BRAND.accent }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
