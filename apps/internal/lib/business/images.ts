/**
 * Logo and icon uploads (Settings → Business), kept as data URLs on the one
 * business_settings row. Small and few, so no storage bucket to set up.
 */

/** PNG, JPEG, WebP and SVG; GIF and others are refused. */
export const BUSINESS_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const

export type BusinessImageType = (typeof BUSINESS_IMAGE_TYPES)[number]

/** 256 KB: plenty for a logo, small enough to keep in a row. */
export const BUSINESS_IMAGE_MAX_BYTES = 256 * 1024

const DATA_URL_RE = /^data:([a-z+/.-]+);base64,([A-Za-z0-9+/=]+)$/

export function isBusinessImageType(type: string): type is BusinessImageType {
  return (BUSINESS_IMAGE_TYPES as readonly string[]).includes(type)
}

export function decodeImageDataUrl(
  value: string | null
): { contentType: BusinessImageType; bytes: Buffer } | null {
  if (!value) return null
  const match = DATA_URL_RE.exec(value)
  if (!match || !isBusinessImageType(match[1])) return null
  return { contentType: match[1], bytes: Buffer.from(match[2], 'base64') }
}

/**
 * Checks an uploaded data URL before it is saved: an allowed type, real
 * base64, within the size limit. Returns the error to show, or null.
 */
export function validateImageDataUrl(value: string): string | null {
  const match = DATA_URL_RE.exec(value)
  if (!match)
    return 'That file could not be read. Try a PNG, JPEG, WebP or SVG.'
  if (!isBusinessImageType(match[1])) {
    return 'Use a PNG, JPEG, WebP or SVG image.'
  }
  const bytes = Buffer.from(match[2], 'base64').length
  if (bytes > BUSINESS_IMAGE_MAX_BYTES) {
    return 'Images must be 256 KB or smaller.'
  }
  return null
}

/** The public URL of an uploaded image, versioned by the last save. */
export function businessImageSrc(
  kind: 'logo' | 'icon',
  present: boolean,
  version: string | null
): string | null {
  if (!present) return null
  const v = version ? `?v=${encodeURIComponent(version)}` : ''
  return `/api/public/business/${kind}${v}`
}
