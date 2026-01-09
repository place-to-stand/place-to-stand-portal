import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getValidAccessToken } from '@/lib/gmail/client'

/**
 * Image proxy endpoint to handle:
 * 1. External images (bypass CORS/referrer issues)
 * 2. Gmail attachment images (cid: references)
 *
 * Usage:
 * - External: /api/emails/image-proxy?url=https://example.com/image.png
 * - Attachment: /api/emails/image-proxy?messageId=xxx&attachmentId=yyy
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const externalUrl = searchParams.get('url')
    const messageId = searchParams.get('messageId')
    const attachmentId = searchParams.get('attachmentId')

    // Handle external image proxy
    if (externalUrl) {
      return await proxyExternalImage(externalUrl)
    }

    // Handle Gmail attachment image
    if (messageId && attachmentId) {
      return await fetchGmailAttachment(user.id, messageId, attachmentId)
    }

    return NextResponse.json({ error: 'Missing url or messageId/attachmentId' }, { status: 400 })
  } catch (error) {
    console.error('Image proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}

/**
 * Check if a hostname resolves to a private/internal IP address.
 * This prevents SSRF attacks targeting internal services or cloud metadata endpoints.
 */
function isPrivateOrReservedHost(hostname: string): boolean {
  // Block localhost variations
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  ) {
    return true
  }

  // Check for IP address patterns that are private/reserved
  // IPv4 patterns
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const [, a, b, c] = ipv4Match.map(Number)

    // 10.0.0.0/8 - Private
    if (a === 10) return true

    // 172.16.0.0/12 - Private
    if (a === 172 && b >= 16 && b <= 31) return true

    // 192.168.0.0/16 - Private
    if (a === 192 && b === 168) return true

    // 127.0.0.0/8 - Loopback
    if (a === 127) return true

    // 169.254.0.0/16 - Link-local (AWS metadata endpoint)
    if (a === 169 && b === 254) return true

    // 0.0.0.0/8 - Current network
    if (a === 0) return true

    // 100.64.0.0/10 - Carrier-grade NAT
    if (a === 100 && b >= 64 && b <= 127) return true

    // 192.0.0.0/24 - IETF Protocol Assignments
    if (a === 192 && b === 0 && c === 0) return true

    // 192.0.2.0/24 - TEST-NET-1
    if (a === 192 && b === 0 && c === 2) return true

    // 198.51.100.0/24 - TEST-NET-2
    if (a === 198 && b === 51 && c === 100) return true

    // 203.0.113.0/24 - TEST-NET-3
    if (a === 203 && b === 0 && c === 113) return true

    // 224.0.0.0/4 - Multicast
    if (a >= 224 && a <= 239) return true

    // 240.0.0.0/4 - Reserved
    if (a >= 240) return true
  }

  // Block IPv6 private/reserved (when enclosed in brackets or raw)
  const ipv6Host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    ipv6Host.startsWith('fc') || // fc00::/7 - Unique local
    ipv6Host.startsWith('fd') || // fc00::/7 - Unique local
    ipv6Host.startsWith('fe80') || // fe80::/10 - Link-local
    ipv6Host === '::1' || // Loopback
    ipv6Host === '::' // Unspecified
  ) {
    return true
  }

  return false
}

async function proxyExternalImage(url: string): Promise<NextResponse> {
  // Validate URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Block requests to private/internal IP addresses (SSRF protection)
  if (isPrivateOrReservedHost(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EmailClient/1.0)',
      'Accept': 'image/*',
    },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status })
  }

  const contentType = response.headers.get('content-type') || 'image/png'
  const buffer = await response.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
    },
  })
}

async function fetchGmailAttachment(
  userId: string,
  messageId: string,
  attachmentId: string
): Promise<NextResponse> {
  const { accessToken } = await getValidAccessToken(userId)

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: response.status })
  }

  const data = await response.json()

  // Gmail returns base64url encoded data
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
  const buffer = Buffer.from(base64, 'base64')

  // Try to determine content type from the data
  const contentType = detectImageType(buffer) || 'image/png'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

function detectImageType(buffer: Buffer): string | null {
  // Check magic bytes
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif'
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp'
  }
  return null
}
