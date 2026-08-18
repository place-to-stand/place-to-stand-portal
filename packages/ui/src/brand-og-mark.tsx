/**
 * The Place To Stand "PTS" mark, drawn for `next/og` ImageResponse.
 *
 * Redrawn rather than served as a static PNG so the DEV band can be
 * composited on top in development — the `app/favicon.ico` shipped alongside
 * it is the same mark as a static asset, copied from the marketing site.
 *
 * Geometry is percentage-based, taken from that asset's 192px canvas (43px
 * bracket arms, 9px stroke, 66px cap height), so every size renders the same
 * mark. Shared by both portals' `icon.tsx` and `apple-icon.tsx`.
 *
 * Plain JSX with inline styles: satori supports no CSS classes, and keeping
 * `next/og` out of this file means the package needs no Next dependency.
 */

/** Marketing brand tokens — see the marketing site's globals.css. */
const BG = '#0e0f11'
const ACCENT = '#b5f542'
const ARM = '22.4%'
const STROKE = '4.7%'

/** Amber, not brand lime: the band is a warning, not part of the identity. */
const DEV_BG = '#f59e0b'
const DEV_TEXT = '#451a03'

type Props = {
  /** Cap height of the wordmark, ~34% of the canvas. */
  fontSize: number
  /** Cap height of the DEV band label. */
  bandFontSize: number
  /** Vertical padding inside the DEV band. */
  bandPadding: number
  /** Callers pass `process.env.NODE_ENV === 'development'`. */
  showDevBand: boolean
}

export function BrandOgMark({
  fontSize,
  bandFontSize,
  bandPadding,
  showDevBand,
}: Props) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: BG,
      }}
    >
      {/* Top-left registration bracket */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: ARM, height: STROKE, backgroundColor: ACCENT }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: STROKE, height: ARM, backgroundColor: ACCENT }} />
      {/* Bottom-right registration bracket */}
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: ARM, height: STROKE, backgroundColor: ACCENT }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: STROKE, height: ARM, backgroundColor: ACCENT }} />

      <div
        style={{
          display: 'flex',
          color: '#ffffff',
          fontSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        PTS
      </div>

      {/* Development gets a band across the middle so a localhost tab is never
          mistaken for production. */}
      {showDevBand && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: 'translateY(-50%)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: DEV_BG,
            color: DEV_TEXT,
            fontSize: bandFontSize,
            fontWeight: 800,
            lineHeight: 1,
            padding: `${bandPadding}px 0`,
          }}
        >
          DEV
        </div>
      )}
    </div>
  )
}
