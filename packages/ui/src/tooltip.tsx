'use client'

import * as React from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'

import { cn } from './cn'

// The arrow is an ARROW_SIZE square rotated 45° and centred on the popup edge,
// so its tip protrudes ARROW_SIZE / √2 past the popup. Offsetting the popup by
// exactly that keeps every tooltip's arrow tip touching its anchor without
// overlapping it. Keep the `size-*`/`-bottom-*` arrow classes in sync.
const ARROW_SIZE = 8
const ARROW_TIP_OFFSET = Math.ceil(ARROW_SIZE / Math.SQRT2)

/**
 * How long the pointer rests on a control before its first tooltip shows.
 * Once one is open, neighbours open at once (Base UI groups tooltips under a
 * shared provider), so a pointer passing by sees nothing and someone reading a
 * toolbar isn't slowed down. Each app mounts one TooltipProvider at its root.
 */
export const TOOLTIP_DELAY_MS = 500

function TooltipProvider({
  delayDuration = TOOLTIP_DELAY_MS,
  ...props
}: Omit<TooltipPrimitive.Provider.Props, 'delay'> & {
  delayDuration?: number
}) {
  return (
    <TooltipPrimitive.Provider
      data-slot='tooltip-provider'
      delay={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  delayDuration,
  ...props
}: TooltipPrimitive.Root.Props & {
  /** Only to opt out of the app-wide delay; this tooltip then stops grouping. */
  delayDuration?: number
}) {
  const root = <TooltipPrimitive.Root data-slot='tooltip' {...props} />
  if (delayDuration === undefined) return root
  return <TooltipProvider delayDuration={delayDuration}>{root}</TooltipProvider>
}

function TooltipTrigger({
  asChild,
  children,
  ...props
}: TooltipPrimitive.Trigger.Props & {
  asChild?: boolean
  children?: ReactNode
}) {
  return (
    <TooltipPrimitive.Trigger
      data-slot='tooltip-trigger'
      render={asChild ? (children as ReactElement) : undefined}
      {...props}
    >
      {asChild ? undefined : children}
    </TooltipPrimitive.Trigger>
  )
}

function TooltipContent({
  className,
  side,
  sideOffset = ARROW_TIP_OFFSET,
  align,
  alignOffset,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className='pointer-events-auto isolate z-50'
      >
        <TooltipPrimitive.Popup
          data-slot='tooltip-content'
          className={cn(
            'bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-closed:animate-out data-closed:fill-mode-forwards data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit rounded-md px-3 py-1.5 text-xs shadow-sm',
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className='fill-primary bg-primary size-2 rotate-45 data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=right]:-left-1 data-[side=top]:-bottom-1' />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
