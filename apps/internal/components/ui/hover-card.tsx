'use client'

import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import type { PopupAlign } from '@placetostand/ui/popup-align'

import { cn } from '@/lib/utils'

/**
 * Built on Base UI's Popover rather than its PreviewCard: the timer contract
 * below (controlled-open cancelling this instance's pending timers, so sliding
 * between triggers can't let a stale close fire ~200ms later and wipe a card
 * the parent just opened) is behaviour PreviewCard does not expose.
 */
const OPEN_DELAY = 50
const CLOSE_DELAY = 200

type HoverCardContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  openTimeoutRef: React.RefObject<ReturnType<typeof setTimeout> | null>
  closeTimeoutRef: React.RefObject<ReturnType<typeof setTimeout> | null>
  /** A mouse or pen is over the trigger. */
  hoveredRef: React.RefObject<boolean>
}

/**
 * Hover means a mouse. A finger or a pen that can't hover fires enter and
 * leave around every tap, and that leave would close the card the tap just
 * opened; a tap (like Enter or Space) opens it as a press instead.
 */
function isHover(event: React.PointerEvent) {
  return event.pointerType === 'mouse'
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(null)

function useHoverCard() {
  const context = React.useContext(HoverCardContext)
  if (!context) {
    throw new Error('HoverCard components must be used within a HoverCard')
  }
  return context
}

type HoverCardProps = {
  children: React.ReactNode
  openDelay?: number
  closeDelay?: number
  /**
   * Optional controlled mode; uncontrolled when absent. Timer semantics are
   * part of the contract: when the controlled `open` flips true, this
   * instance's pending open/close timers are cancelled, so a stale close
   * timer from a previous hover never fires after the parent opened the card.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function HoverCard({
  children,
  openDelay = OPEN_DELAY,
  closeDelay = CLOSE_DELAY,
  open: controlledOpen,
  onOpenChange,
}: HoverCardProps) {
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const hoveredRef = React.useRef(false)

  const setOpenState = React.useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen)
      } else {
        setUncontrolledOpen(nextOpen)
      }
    },
    [isControlled, onOpenChange]
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current)
          closeTimeoutRef.current = null
        }
        openTimeoutRef.current = setTimeout(() => {
          setOpenState(true)
        }, openDelay)
      } else {
        if (openTimeoutRef.current) {
          clearTimeout(openTimeoutRef.current)
          openTimeoutRef.current = null
        }
        closeTimeoutRef.current = setTimeout(() => {
          setOpenState(false)
        }, closeDelay)
      }
    },
    [openDelay, closeDelay, setOpenState]
  )

  // Controlled-open cancels this instance's pending timers: without
  // this, sliding from another trigger leaves a stale close timer that fires
  // ~200ms after the parent force-opened this card and wipes it.
  React.useEffect(() => {
    if (isControlled && controlledOpen) {
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current)
        openTimeoutRef.current = null
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [controlledOpen, isControlled])

  React.useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current)
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  return (
    <HoverCardContext.Provider
      value={{
        open,
        setOpen: handleOpenChange,
        openTimeoutRef,
        closeTimeoutRef,
        hoveredRef,
      }}
    >
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(nextOpen, details) => {
          // A click on a trigger the mouse already opened keeps the card
          // open: a press there means "show me", not "hide it".
          if (
            !nextOpen &&
            details.reason === 'trigger-press' &&
            hoveredRef.current
          ) {
            details.cancel()
            return
          }
          setOpenState(nextOpen)
        }}
      >
        {children}
      </PopoverPrimitive.Root>
    </HoverCardContext.Provider>
  )
}

function HoverCardTrigger({
  className,
  children,
  asChild,
  ...props
}: PopoverPrimitive.Trigger.Props & { asChild?: boolean }) {
  const { setOpen, hoveredRef } = useHoverCard()

  // `asChild` maps onto Base UI's `render`; callers wrap links and table cells
  // so the trigger stays whatever element they already had.
  const renderProps =
    asChild && React.isValidElement(children)
      ? { render: children as React.ReactElement<Record<string, unknown>> }
      : { children }

  return (
    <PopoverPrimitive.Trigger
      data-slot='hover-card-trigger'
      className={className}
      onPointerEnter={event => {
        if (!isHover(event)) return
        hoveredRef.current = true
        setOpen(true)
      }}
      onPointerLeave={event => {
        if (!isHover(event)) return
        hoveredRef.current = false
        setOpen(false)
      }}
      // Enter and Space toggle the card even with the mouse resting on it.
      onKeyDown={() => {
        hoveredRef.current = false
      }}
      {...renderProps}
      {...props}
    />
  )
}

/** Opens left-aligned to its trigger, like every popup (house rule 4). */
function HoverCardContent({
  className,
  align,
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'sideOffset'> & {
    align?: PopupAlign
  }) {
  const { setOpen, closeTimeoutRef } = useHoverCard()

  const handlePointerEnter = React.useCallback(
    (event: React.PointerEvent) => {
      if (!isHover(event)) return
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    },
    [closeTimeoutRef]
  )

  // A finger lifting off the card (or ending a scroll in it) isn't leaving.
  const handlePointerLeave = React.useCallback(
    (event: React.PointerEvent) => {
      if (!isHover(event)) return
      setOpen(false)
    },
    [setOpen]
  )

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align ?? 'start'}
        sideOffset={sideOffset}
        className='pointer-events-auto isolate z-50'
      >
        <PopoverPrimitive.Popup
          data-slot='hover-card-content'
          // Hover-opened cards must not steal focus (the first link would
          // render focused/highlighted); keyboard opens keep the default so
          // Tab still lands inside the popup.
          initialFocus={openType => (openType === 'keyboard' ? true : false)}
          className={cn(
            // fill-mode-forwards holds the exit frame so the card doesn't
            // blink back at full opacity before unmounting.
            'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 shadow-popover z-50 w-64 origin-(--transform-origin) rounded-md border p-4 outline-hidden',
            className
          )}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
