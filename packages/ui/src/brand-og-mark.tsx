/**
 * Development favicon for `next/og` ImageResponse: the real brand asset
 * (see `brand-icon-assets.ts`) with a DEV band composited across the middle
 * so a localhost tab is never mistaken for production.
 *
 * Production never renders this — the portals' icon routes serve the
 * embedded PNG bytes directly so tabs match the marketing site exactly.
 * (An earlier revision redrew the mark with satori text, but satori loads
 * no bold font by default, so the wordmark rendered thin and blurry.)
 *
 * Plain JSX with inline styles: satori supports no CSS classes, and keeping
 * `next/og` out of this file means the package needs no Next dependency.
 */

/** Amber, not brand lime: the band is a warning, not part of the identity. */
const DEV_BG = '#f59e0b'
const DEV_TEXT = '#451a03'

type Props = {
  /** Base icon as a data URI, e.g. `data:image/png;base64,...`. */
  src: string
  /** Canvas size in px — the icon route's `size` export. */
  width: number
  height: number
  /** Cap height of the DEV band label. */
  bandFontSize: number
  /** Vertical padding inside the DEV band. */
  bandPadding: number
}

export function BrandOgMark({
  src,
  width,
  height,
  bandFontSize,
  bandPadding,
}: Props) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
      }}
    >
      {/* Satori canvas, not the DOM — next/image rules don't apply here. */}
      <img src={src} width={width} height={height} alt='' />
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
    </div>
  )
}
