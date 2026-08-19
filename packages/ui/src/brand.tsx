import { cn } from './cn'

/**
 * Place To Stand brand marks, matching the marketing site.
 *
 * Deliberately scoped to signed-out surfaces (the auth screens of both
 * portals). The signed-in apps keep their own header logos — do not swap those
 * out for these.
 *
 * Colours are literal hex rather than portal theme tokens on purpose: this is
 * the marketing palette, which is dark-only and independent of whichever theme
 * the portal is in.
 */

/** Marketing brand tokens — see the marketing site's globals.css. */
export const BRAND = {
  bg: '#0e0f11',
  bgPanel: 'rgba(22, 24, 28, 0.88)',
  border: '#2a2b30',
  borderLight: '#3a3b40',
  text: '#e8e6e3',
  textMuted: '#a8a8ac',
  accent: '#b5f542',
  gridDot: '#2a2b30',
} as const

/**
 * The "PTS" tile: dark canvas, lime registration brackets at opposing corners.
 * Same geometry as the favicon (`brand-og-mark.tsx`), expressed in ems so it
 * scales with `size`.
 */
export function BrandMark({
  size = 40,
  className,
}: {
  size?: number
  className?: string
}) {
  const arm = size * 0.224
  const stroke = Math.max(1, size * 0.047)

  return (
    <span
      aria-hidden
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size, backgroundColor: BRAND.bg }}
    >
      <span style={{ position: 'absolute', top: 0, left: 0, width: arm, height: stroke, backgroundColor: BRAND.accent }} />
      <span style={{ position: 'absolute', top: 0, left: 0, width: stroke, height: arm, backgroundColor: BRAND.accent }} />
      <span style={{ position: 'absolute', bottom: 0, right: 0, width: arm, height: stroke, backgroundColor: BRAND.accent }} />
      <span style={{ position: 'absolute', bottom: 0, right: 0, width: stroke, height: arm, backgroundColor: BRAND.accent }} />
      <span
        className="font-bold leading-none tracking-tight text-white"
        style={{ fontSize: size * 0.34 }}
      >
        PTS
      </span>
    </span>
  )
}

/**
 * Mark + wordmark + a mono micro-label naming which portal you are signing in
 * to. `label` is what distinguishes the two apps' screens from each other.
 */
export function BrandLockup({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <BrandMark size={44} />
      <div className="flex flex-col items-center gap-2">
        <span
          className="text-xl font-bold tracking-tight"
          style={{
            color: BRAND.text,
            fontFamily: 'var(--font-space-grotesk, inherit)',
          }}
        >
          Place To Stand
        </span>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.1em]"
          style={{ color: BRAND.accent }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
