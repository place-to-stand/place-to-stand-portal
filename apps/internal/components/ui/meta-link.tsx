import Link from 'next/link'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The look of every small text link on a card, row or widget meta line (a
 * client or project on a task, an email on a lead): it keeps the muted text it
 * sits in, then turns to `foreground` and underlines on hover. The underline
 * offset comes from `body` in theme.css.
 */
export const metaLinkClass =
  'hover:text-foreground inline-flex max-w-full min-w-0 items-center gap-1 transition hover:underline'

type MetaLinkProps = {
  /** An app path opens with next/link; mailto:, tel: and http(s) stay plain anchors. */
  href?: string
  /** Without `href` the link is a button (e.g. stacking a sheet). */
  onClick?: (event: MouseEvent<HTMLElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  /** Leading icon, sized by the caller (`h-3.5 w-3.5 shrink-0` on cards). */
  icon?: ReactNode
  children: ReactNode
  /** Full text for a label that may truncate; links only (house rule 11 keeps title off buttons). */
  title?: string
  className?: string
}

/**
 * A text link with an optional icon and a label that truncates. The label uses
 * `truncate-link`, never `truncate`: `truncate` clips the hover underline, so
 * the link would only change colour.
 */
export function MetaLink({
  href,
  onClick,
  onKeyDown,
  icon,
  children,
  title,
  className,
}: MetaLinkProps) {
  const classes = cn(metaLinkClass, className)
  const content = (
    <>
      {icon}
      <span className='truncate-link'>{children}</span>
    </>
  )

  if (!href) {
    return (
      <button
        type='button'
        className={classes}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {content}
      </button>
    )
  }

  if (/^(mailto:|tel:|https?:)/.test(href)) {
    return (
      <a
        href={href}
        className={classes}
        title={title}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      href={href}
      className={classes}
      title={title}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {content}
    </Link>
  )
}
