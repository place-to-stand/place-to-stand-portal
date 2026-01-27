import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 32, height: 32 }

const isDev = process.env.NODE_ENV === 'development'

export default function Icon() {
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
              fontSize: '9px',
              fontWeight: 800,
              padding: '2px 0',
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
