'use client'

import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

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
  openTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  closeTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
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
   * Optional controlled mode (backward-compatible: uncontrolled when absent).
   * Timer semantics are part of the contract: when the controlled `open`
   * flips true, this instance's pending open/close timers are cancelled — a
   * stale close timer from a previous hover must never fire after the parent
   * opened the card.
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

  // Controlled-open cancels this instance's pending timers (R8): without
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
      }}
    >
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={nextOpen => setOpenState(nextOpen)}
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
  const { setOpen } = useHoverCard()

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
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      {...renderProps}
      {...props}
    />
  )
}

/**
 * Keeps the Radix transform-origin variable resolving, so the origin-(...)
 * class above still anchors the zoom animation correctly.
 */
const radixVarAliases = {
  '--radix-popover-content-transform-origin': 'var(--transform-origin)',
} as React.CSSProperties

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'sideOffset'>) {
  const { setOpen, closeTimeoutRef } = useHoverCard()

  const handlePointerEnter = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [closeTimeoutRef])

  const handlePointerLeave = React.useCallback(() => {
    setOpen(false)
  }, [setOpen])

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        sideOffset={sideOffset}
        className='pointer-events-auto isolate z-50'
      >
        <PopoverPrimitive.Popup
          data-slot='hover-card-content'
          // Hover-opened cards must not steal focus (the first link would
          // render focused/highlighted); keyboard opens keep the default so
          // Tab still lands inside the popup.
          initialFocus={openType => (openType === 'keyboard' ? true : false)}
          style={radixVarAliases}
          className={cn(
            // data-open/data-closed are Base UI's spelling of Radix's
            // data-[state=*]. fill-mode-forwards holds the exit frame so the
            // card doesn't blink back at full opacity before unmounting.
            'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-64 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
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
