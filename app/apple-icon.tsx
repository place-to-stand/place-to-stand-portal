import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 180, height: 180 }

const isDev = process.env.NODE_ENV === 'development'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Gradient circle background */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #c084fc 0%, #67e8f9 100%)',
          }}
        />
        {/* DEV banner across middle in development mode */}
        {isDev && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#f59e0b',
              color: '#451a03',
              fontSize: '48px',
              fontWeight: 800,
              padding: '8px 0',
              lineHeight: 1,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            DEV
          </div>
        )}
      </div>
    ),
    {
      ...size,
    }
  )
}
