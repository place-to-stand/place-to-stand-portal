import { ImageResponse } from 'next/og'
import type { CSSProperties } from 'react'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { DEFAULT_BUSINESS_NAME } from '@pts/db/business'

import { getBusinessIdentityOrDefaults } from '@/lib/business/identity'

/**
 * Social share image (Open Graph / Twitter card), rendered from code.
 *
 * It is built from the brand, not from a page: dark blueprint ground, the
 * 24px dot grid, accent corner marks, the logo mark and the business's name
 * and website from Settings → Business. Read per request, so it follows a
 * rename without a redeploy.
 *
 * Fonts come from public/fonts, the same files the referral PDF uses.
 */

export const dynamic = 'force-dynamic'
export const alt = 'Client portal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Brand tokens, mirrored from app/globals.css. Satori cannot read CSS
// variables, so the values are repeated here on purpose.
const color = {
  bg: '#0e0f11',
  text: '#e8e6e3',
  textMuted: '#a8a8ac',
  accent: '#b5f542',
  gridDot: '#33343c',
}

// 24px blueprint grid. The frame padding is 72px (3 cells) so the corner
// marks and the wordmark sit on grid lines, as they do on the site.
const GRID = 24
const FRAME = GRID * 3
const CORNER = 20

const fontDir = path.join(process.cwd(), 'public', 'fonts')

// One 24px tile with a dot at its center, tiled across the card. Satori
// renders a repeated SVG background reliably where it drops the site's
// radial-gradient recipe. The layer is shifted by half a cell so the dots
// land on the grid lines (0, 24, 48 …), matching the site.
const dotTile = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID}" height="${GRID}">` +
    `<circle cx="${GRID / 2}" cy="${GRID / 2}" r="1.5" fill="${color.gridDot}"/>` +
    `</svg>`
)

function DotGrid() {
  return (
    <div
      style={{
        position: 'absolute',
        top: -GRID / 2,
        left: -GRID / 2,
        width: size.width + GRID,
        height: size.height + GRID,
        backgroundImage: `url("data:image/svg+xml,${dotTile}")`,
        backgroundSize: `${GRID}px ${GRID}px`,
        backgroundRepeat: 'repeat',
      }}
    />
  )
}

function CornerMark({ top, left }: { top?: boolean; left?: boolean }) {
  // Satori reads every key in `style`, and a key set to `undefined` makes it
  // throw, so only the properties this corner needs are set. Longhand border
  // properties are used because Satori does not parse per-side shorthand.
  const style: CSSProperties = {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  }
  const border = { width: 2, style: 'solid', color: color.accent } as const
  if (top) {
    style.top = FRAME
    style.borderTopWidth = border.width
    style.borderTopStyle = border.style
    style.borderTopColor = border.color
  } else {
    style.bottom = FRAME
    style.borderBottomWidth = border.width
    style.borderBottomStyle = border.style
    style.borderBottomColor = border.color
  }
  if (left) {
    style.left = FRAME
    style.borderLeftWidth = border.width
    style.borderLeftStyle = border.style
    style.borderLeftColor = border.color
  } else {
    style.right = FRAME
    style.borderRightWidth = border.width
    style.borderRightStyle = border.style
    style.borderRightColor = border.color
  }
  return <div style={style} />
}

export default async function OpenGraphImage() {
  const [spaceGrotesk, sourceSans, business] = await Promise.all([
    readFile(path.join(fontDir, 'SpaceGrotesk-Bold.ttf')),
    readFile(path.join(fontDir, 'SourceSans3-Regular.ttf')),
    getBusinessIdentityOrDefaults(),
  ])
  const name = business?.name ?? DEFAULT_BUSINESS_NAME

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: FRAME + GRID,
        backgroundColor: color.bg,
        overflow: 'hidden',
        color: color.text,
        fontFamily: 'Source Sans 3',
      }}
    >
      <DotGrid />
      <CornerMark top left />
      <CornerMark />

      {/* Logo mark + wordmark, as in the site header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            border: `2px solid ${color.accent}`,
          }}
        >
          <div
            style={{ width: 12, height: 12, backgroundColor: color.accent }}
          />
        </div>
        <div
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          {name}
        </div>
      </div>

      {/* What the portal is for */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Space Grotesk',
          fontSize: 74,
          fontWeight: 700,
          lineHeight: 0.98,
          letterSpacing: '-0.03em',
        }}
      >
        <div style={{ display: 'flex' }}>Projects, hours</div>
        <div style={{ display: 'flex' }}>and invoices,</div>
        <div style={{ display: 'flex', color: color.accent }}>
          in one place.
        </div>
      </div>

      {/* Footer: what this is, and the business's website */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 26,
          color: color.textMuted,
        }}
      >
        <div style={{ display: 'flex' }}>Client portal</div>
        <div style={{ display: 'flex' }}>{business?.websiteLabel ?? ''}</div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'Space Grotesk',
          data: spaceGrotesk,
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Source Sans 3',
          data: sourceSans,
          weight: 400,
          style: 'normal',
        },
      ],
    }
  )
}
