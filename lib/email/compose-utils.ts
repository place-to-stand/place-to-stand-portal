/**
 * Utility functions for email composition
 */

/**
 * Escapes HTML special characters and converts newlines to <br> tags.
 * Used for safely rendering plain text in HTML context.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
}

/**
 * Formats a byte count into a human-readable file size string.
 * @param bytes - The file size in bytes
 * @returns Formatted string like "1.5 KB" or "2.3 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Strips HTML tags from a string, converting common elements to plain text equivalents.
 * More robust than naive regex - handles line breaks, entities, and nested tags.
 */
export function stripHtmlTags(html: string): string {
  return html
    // Convert line-breaking elements to newlines first
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Put URL links on their own line (common in signatures)
    .replace(/<a\s[^>]*href\s*=\s*["'][^"']*["'][^>]*>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    // Clean up multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
