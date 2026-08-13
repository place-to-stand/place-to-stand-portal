'use client'

import {
  cloneElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
} from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'

type PassThroughProps = Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'className' | 'style'
>

type DisabledFieldTooltipProps = PassThroughProps & {
  disabled: boolean
  reason?: string | null
  // Widened to include the pass-through props so cloneElement accepts them:
  // the child is the element that actually receives them.
  children: ReactElement<
    { className?: string; style?: CSSProperties } & PassThroughProps
  >
  className?: string
}

/**
 * Wraps a field so a disabled control can still explain itself on hover.
 *
 * Anything it does not consume is forwarded to the child. That matters when
 * this sits inside a `FormControl`, which injects `id`, `aria-describedby`
 * and `aria-invalid` onto its single child: without the pass-through those
 * land on this wrapper and are dropped, so the field's `<label for>` points
 * at an id that exists on nothing and clicking the label focuses nothing.
 */
export function DisabledFieldTooltip({
  disabled,
  reason,
  children,
  className,
  ...passThrough
}: DisabledFieldTooltipProps) {
  if (!disabled || !reason) {
    return cloneElement(children, passThrough)
  }

  const { className: childClassName, style: childStyle } = children.props

  const wrappedChild = cloneElement(children, {
    ...passThrough,
    className: cn(childClassName, 'pointer-events-none'),
    style: { ...childStyle, pointerEvents: 'none' },
  })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn('cursor-not-allowed', className)}
          aria-disabled='true'
        >
          <div>{wrappedChild}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}
