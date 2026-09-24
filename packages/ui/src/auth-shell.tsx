import type { ReactNode } from 'react'

import { BRAND, BRAND_DOT_GRID, BrandLockup } from './brand'
import { cn } from './cn'

/**
 * The signed-out chrome for both portals: the marketing site's dark blueprint
 * background, the PTS lockup, and a translucent panel for whatever form the
 * page owns.
 *
 * Dark regardless of the viewer's theme. The marketing identity is dark-only,
 * and these screens are the handoff from the marketing site — the signed-in
 * app picks the theme back up on the other side of the form.
 *
 * Only auth screens use this. Everything behind the login keeps its own
 * header and theme.
 */

type Props = {
  /** Mono micro-label under the wordmark, e.g. "Internal Portal". */
  label: string
  title: string
  description?: ReactNode
  /** The form. */
  children: ReactNode
  /** Secondary links ("Back to sign in"), rendered under the panel. */
  footer?: ReactNode
  /** Widen the panel for denser forms (password reset). */
  wide?: boolean
}

export function AuthShell({
  label,
  title,
  description,
  children,
  footer,
  wide = false,
}: Props) {
  return (
    <div
      className='flex min-h-screen flex-col items-center justify-center px-6 py-12'
      style={{ backgroundColor: BRAND.bg, ...BRAND_DOT_GRID }}
    >
      <div className={cn('w-full space-y-8', wide ? 'max-w-md' : 'max-w-sm')}>
        <BrandLockup label={label} />

        <div
          className='space-y-6 border p-8'
          style={{
            backgroundColor: BRAND.bgPanel,
            borderColor: BRAND.border,
          }}
        >
          <div className='space-y-2 text-center'>
            <h1
              className='text-2xl font-bold tracking-tight'
              style={{
                color: BRAND.text,
                fontFamily: 'var(--font-space-grotesk, inherit)',
              }}
            >
              {title}
            </h1>
            {description ? (
              <p className='text-sm' style={{ color: BRAND.textMuted }}>
                {description}
              </p>
            ) : null}
          </div>

          {children}
        </div>

        {footer ? (
          <div
            className='text-center text-sm'
            style={{ color: BRAND.textMuted }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Control styling for forms rendered inside the shell.
 *
 * Exported as class strings rather than components because the two portals'
 * auth forms are structurally different (server actions vs. client state) and
 * only need to agree on how a field looks.
 */
export const authFieldLabelClass =
  'block font-mono text-[11px] uppercase tracking-[0.1em] text-brand-text-muted'

export const authInputClass =
  'w-full border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-text-muted/50 transition-colors focus:border-brand-lime focus:outline-none focus:ring-1 focus:ring-brand-lime disabled:opacity-50'

export const authPrimaryButtonClass =
  'inline-flex w-full cursor-pointer items-center justify-center gap-2 bg-brand-lime px-3 py-2 text-sm font-semibold text-brand-bg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:cursor-default disabled:opacity-50'

export const authSecondaryButtonClass =
  'inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-brand-border-light bg-transparent px-3 py-2 text-sm font-medium text-brand-text transition-colors hover:border-brand-lime/50 hover:text-brand-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime disabled:cursor-default disabled:opacity-50'

export const authLinkClass =
  'font-medium text-brand-lime underline-offset-4 hover:underline'

export const authErrorClass =
  // Raw red on purpose: the auth ground is always dark, whatever the theme,
  // and the theme's `destructive` is tuned for the light page in light mode.
  'border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300'

export const authNoticeClass =
  'border border-brand-border-light bg-brand-bg/60 px-3 py-2 text-sm text-brand-text-muted'
