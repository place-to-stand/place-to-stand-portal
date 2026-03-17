/**
 * Email HTML sanitization utilities
 *
 * These functions prepare email HTML for safe display in iframes by:
 * - Proxying external images through our API to bypass CORS/referrer issues
 * - Replacing CID references with proxy URLs for inline attachments
 * - Removing potentially dangerous elements (scripts, event handlers)
 */

export type CidMapping = {
  contentId: string
  attachmentId: string
  mimeType: string
  filename?: string
}

export type SanitizeOptions = {
  externalMessageId?: string | null
  cidMappings?: CidMapping[]
}

/**
 * Sanitize email HTML for safe display in iframe
 * - Proxies external images through our API to bypass CORS/referrer issues
 * - Replaces CID references with proxy URLs for inline attachments
 * - Removes potentially dangerous elements
 */
export function sanitizeEmailHtml(
  html: string,
  options?: SanitizeOptions
): string {
  let result = html

  // Replace CID image references with proxy URLs
  if (options?.externalMessageId && options?.cidMappings?.length) {
    const { externalMessageId, cidMappings } = options

    // Create a map for quick lookup
    const cidMap = new Map(cidMappings.map(m => [m.contentId, m]))

    // Replace cid: references in src attributes
    result = result.replace(
      /<img\s+([^>]*?)src=["']cid:([^"']+)["']([^>]*)>/gi,
      (_match, before, cid, after) => {
        const mapping = cidMap.get(cid)
        if (mapping) {
          const proxiedSrc = `/api/emails/image-proxy?messageId=${encodeURIComponent(externalMessageId)}&attachmentId=${encodeURIComponent(mapping.attachmentId)}`
          return `<img ${before}src="${proxiedSrc}" loading="lazy"${after}>`
        }
        // If no mapping found, hide the broken image
        return `<img ${before}src="" style="display:none"${after}>`
      }
    )
  }

  return (
    result
      // Proxy external images through our API
      .replace(
        /<img\s+([^>]*?)src=["']((https?:\/\/[^"']+))["']([^>]*)>/gi,
        (_match, before, src, _fullSrc, after) => {
          const proxiedSrc = `/api/emails/image-proxy?url=${encodeURIComponent(src)}`
          return `<img ${before}src="${proxiedSrc}" loading="lazy"${after}>`
        }
      )
      // Remove script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove onclick and similar event handlers
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '')
  )
}
