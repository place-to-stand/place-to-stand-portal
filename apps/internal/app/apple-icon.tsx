import { ImageResponse } from 'next/og'

import { BRAND_APPLE_ICON_PNG_BASE64 } from '@pts/ui/brand-icon-assets'
import { BrandOgMark } from '@pts/ui/brand-og-mark'

export const contentType = 'image/png'
export const size = { width: 180, height: 180 }

const isDev = process.env.NODE_ENV === 'development'

export default function AppleIcon() {
  // Production serves the marketing site's asset byte-for-byte; only dev
  // pays for satori, to composite the DEV band on top.
  if (!isDev) {
    return new Response(
      Buffer.from(BRAND_APPLE_ICON_PNG_BASE64, 'base64'),
      { headers: { 'Content-Type': contentType } }
    )
  }

  return new ImageResponse(
    (
      <BrandOgMark
        src={`data:image/png;base64,${BRAND_APPLE_ICON_PNG_BASE64}`}
        width={size.width}
        height={size.height}
        bandFontSize={50}
        bandPadding={11}
      />
    ),
    { ...size }
  )
}
