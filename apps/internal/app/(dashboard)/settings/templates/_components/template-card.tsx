'use client'

import { useEffect, useRef, useState } from 'react'

import { Badge } from '@pts/ui/badge'
import type { TemplateAudience } from '@/lib/templates/audience'
import { cn } from '@/lib/utils'

import { AUDIENCE_STYLES } from './template-labels'

const THUMBNAIL_HEIGHT = 144
/** Width an HTML email is laid out at before it is scaled into the card. */
const HTML_RENDER_WIDTH = 640

/**
 * A gallery card: a live render of the template over its name and who reads
 * it. Rendering the real output (rather than a saved screenshot) means a
 * thumbnail can never drift from its template.
 */
export function TemplateCard({
  name,
  audiences,
  notice,
  thumbnail,
  onOpen,
}: {
  name: string
  audiences: TemplateAudience[]
  /** A short warning badge after the recipients ("Not sent", "Webhook off"). */
  notice?: string
  thumbnail: React.ReactNode
  onOpen: () => void
}) {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      onClick={onOpen}
      className='bg-background hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-ring/50 flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border text-left shadow-sm transition-colors outline-none focus-visible:ring-[3px]'
    >
      <div
        aria-hidden='true'
        className='relative w-full shrink-0 overflow-hidden bg-[#f4f4f2]'
        style={{ height: THUMBNAIL_HEIGHT }}
      >
        {thumbnail}
      </div>
      <span className='flex flex-col gap-1.5 border-t px-3 py-2.5'>
        <span className='truncate text-sm font-medium'>{name}</span>
        <span className='flex flex-wrap gap-1'>
          {audiences.map(audience => (
            <Badge
              key={audience}
              variant='outline'
              className={cn(
                'font-normal',
                AUDIENCE_STYLES[audience].badgeClassName
              )}
            >
              {AUDIENCE_STYLES[audience].label}
            </Badge>
          ))}
          {notice ? <Badge variant='destructive'>{notice}</Badge> : null}
        </span>
      </span>
    </button>
  )
}

/**
 * Lays its children out at a fixed width and scales them to the card. The
 * scale is measured, not guessed, because the grid's column width changes with
 * the viewport; nothing renders until it is known. `children` gets the height
 * to fill at that width, so it covers the whole thumbnail once scaled.
 */
function ScaledThumbnail({
  width,
  children,
}: {
  width: number
  children: (height: number) => React.ReactNode
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={frameRef} className='absolute inset-0'>
      {scale ? (
        <div
          className='pointer-events-none absolute top-0 left-0 origin-top-left'
          style={{ width, transform: `scale(${scale})` }}
        >
          {children(THUMBNAIL_HEIGHT / scale)}
        </div>
      ) : null}
    </div>
  )
}

/** An HTML email laid out at full width in a sandboxed frame, scaled down. */
export function HtmlThumbnail({ html }: { html: string }) {
  return (
    <ScaledThumbnail width={HTML_RENDER_WIDTH}>
      {height => (
        <iframe
          title=''
          tabIndex={-1}
          sandbox=''
          loading='lazy'
          srcDoc={html}
          className='block w-full border-0'
          style={{ height }}
        />
      )}
    </ScaledThumbnail>
  )
}

/** Any rendered preview (a chat card, say) laid out at `width`, scaled down. */
export function NodeThumbnail({
  width,
  children,
}: {
  width: number
  children: React.ReactNode
}) {
  return (
    <ScaledThumbnail width={width}>
      {height => (
        <div className='flex flex-col' style={{ minHeight: height }}>
          {children}
        </div>
      )}
    </ScaledThumbnail>
  )
}

/**
 * The browser's PDF viewer with its chrome hidden, fitting the first page to
 * the card's width; the card crops it to the top of the page. Unscaled on
 * purpose: the viewer is a plugin and does not paint inside a transform.
 */
export function PdfThumbnail({ src }: { src: string }) {
  return (
    <iframe
      title=''
      tabIndex={-1}
      loading='lazy'
      src={`${src}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
      className='pointer-events-none absolute inset-0 h-[400%] w-full border-0'
    />
  )
}
