import { ImageResponse } from 'next/og'

import { BrandOgMark } from '@pts/ui/brand-og-mark'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 180, height: 180 }

const isDev = process.env.NODE_ENV === 'development'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <BrandOgMark
        fontSize={61}
        bandFontSize={44}
        bandPadding={8}
        showDevBand={isDev}
      />
    ),
    { ...size }
  )
}
