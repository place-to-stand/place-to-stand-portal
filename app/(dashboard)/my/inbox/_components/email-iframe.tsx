'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

type EmailIframeProps = {
  html: string
  className?: string
}

/**
 * Renders email HTML content in an isolated iframe to prevent
 * email styles from leaking into the parent document.
 *
 * Emails are always rendered with a light background since they are
 * designed for light mode. This ensures readability regardless of
 * the app's theme setting.
 */
export function EmailIframe({ html, className }: EmailIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  // Wrap HTML with light-mode styling
  // Emails are designed for light backgrounds - don't try to force dark mode
  const wrappedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <style>
    :root {
      color-scheme: light only;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      overflow-x: hidden;
    }
    body {
      padding: 16px;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    a {
      color: #2563eb;
    }
    pre, code {
      white-space: pre-wrap;
      word-break: break-word;
    }
    table {
      max-width: 100%;
    }
  </style>
</head>
<body>${html}</body>
</html>
`

  const updateHeight = useCallback(() => {
    if (!iframeRef.current?.contentDocument?.body) return
    const scrollHeight = iframeRef.current.contentDocument.body.scrollHeight
    // Add small buffer and set minimum height
    setHeight(Math.max(100, scrollHeight + 16))
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      updateHeight()
      // Also update after images load
      const doc = iframe.contentDocument
      if (doc) {
        const images = doc.querySelectorAll('img')
        images.forEach(img => {
          if (!img.complete) {
            img.addEventListener('load', updateHeight)
            img.addEventListener('error', updateHeight)
          }
        })
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [updateHeight])

  // Update when html changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // Small delay to let iframe render
    const timer = setTimeout(updateHeight, 100)
    return () => clearTimeout(timer)
  }, [html, updateHeight])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        border: 'none',
        display: 'block',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
      sandbox='allow-same-origin'
      title='Email content'
    />
  )
}
