import { ImageResponse } from 'next/og'

import { BrandOgMark } from '@pts/ui/brand-og-mark'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 32, height: 32 }

const isDev = process.env.NODE_ENV === 'development'

export default function Icon() {
  return new ImageResponse(
    (
      <BrandOgMark
        fontSize={11}
        bandFontSize={9}
        bandPadding={2}
        showDevBand={isDev}
      />
    ),
    { ...size }
  )
}
