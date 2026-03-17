'use client'

import { useMemo } from 'react'
import DOMPurify from 'dompurify'

import { cn } from '@/lib/utils'

/**
 * Prepare Google Docs export HTML for rendering.
 *
 * Google Docs export includes inline styles, <style> blocks, and a full
 * <html> wrapper. We extract the body, strip Google's styling so Tailwind
 * prose can handle presentation, then sanitize with DOMPurify.
 */
function prepareGoogleDocHtml(html: string): string {
  // Extract just the <body> content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  let content = bodyMatch ? bodyMatch[1] : html

  // Remove <style> blocks
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Strip all style attributes — let prose handle styling
  content = content.replace(/\s+style="[^"]*"/gi, '')
  content = content.replace(/\s+style='[^']*'/gi, '')

  // Strip class attributes (Google adds c0, c1, etc.)
  content = content.replace(/\s+class="[^"]*"/gi, '')

  // Strip id attributes
  content = content.replace(/\s+id="[^"]*"/gi, '')

  // Clean up empty paragraphs (Google Docs outputs <p><span></span></p> for blank lines)
  content = content.replace(/<p>\s*<span>\s*<\/span>\s*<\/p>/gi, '')

  // Remove Google's empty bookmark anchors
  content = content.replace(/<a\s*>\s*<\/a>/gi, '')

  // Sanitize with DOMPurify — allow structural HTML only
  content = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'b', 'em', 'i', 'u', 's',
      'ul', 'ol', 'li',
      'a', 'span',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'pre', 'code',
      'sup', 'sub',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })

  return content.trim()
}

interface TranscriptHtmlRendererProps {
  html: string
  className?: string
}

export function TranscriptHtmlRenderer({ html, className }: TranscriptHtmlRendererProps) {
  const sanitized = useMemo(() => prepareGoogleDocHtml(html), [html])

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        // Tighten up spacing for transcript content
        'prose-p:my-1.5 prose-headings:mt-6 prose-headings:mb-2',
        'prose-li:my-0.5',
        // Make links safe
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
