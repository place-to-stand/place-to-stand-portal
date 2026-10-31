'use client'

import * as React from 'react'
import { ExternalLink } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Input } from '@pts/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
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
 * valid link, opening it in a new tab. Use for every URL field.
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
          'flex w-full min-w-0 items-center gap-1',
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
                <ExternalLink className='size-3.5' aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{openLabel}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    )
  }
)
