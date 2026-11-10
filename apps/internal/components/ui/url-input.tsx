'use client'

import * as React from 'react'
import { Button } from '@pts/ui/button'
import { Input } from '@pts/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { SiteMark } from '@/components/ui/site-mark'
import { cn } from '@/lib/utils'

/** A safe https link from what was typed (scheme optional), or null. */
export function toSafeHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.hostname.includes('.') ? url.toString() : null
  } catch {
    return null
  }
}

type UrlInputProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  /** Tooltip and label for the open button: "Open website". */
  openLabel: string
  /** Wrapper classes (width, grid placement). */
  wrapperClassName?: string
}

/**
 * A URL field with the same open button as the record pickers: beside the
 * field (4px gap, field height, tooltip), shown only while the value is a
 * valid link, opening it in a new tab. Its icon is the site's mark
 * (`SiteMark`). Use for every URL field.
 */
export const UrlInput = React.forwardRef<HTMLInputElement, UrlInputProps>(
  function UrlInput(
    { openLabel, wrapperClassName, value, ...inputProps },
    ref
  ) {
    const href = toSafeHref(typeof value === 'string' ? value : null)
    return (
      <div
        className={cn(
          // Field to its Open button: the same 8px as a picker to its Open
          // button (SearchableCombobox).
          'flex w-full min-w-0 items-center gap-2',
          wrapperClassName
        )}
      >
        <Input
          ref={ref}
          type='text'
          inputMode='url'
          value={value}
          {...inputProps}
        />
        {href ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='text-muted-foreground shrink-0'
                aria-label={openLabel}
                onClick={() =>
                  window.open(href, '_blank', 'noopener,noreferrer')
                }
              >
                <SiteMark href={href} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{openLabel}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    )
  }
)
