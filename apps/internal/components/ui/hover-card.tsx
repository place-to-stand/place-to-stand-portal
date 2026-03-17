'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'

import { cn } from '@/lib/utils'

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
}

function HoverCard({
  children,
  openDelay = OPEN_DELAY,
  closeDelay = CLOSE_DELAY,
}: HoverCardProps) {
  const [open, setOpen] = React.useState(false)
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current)
          closeTimeoutRef.current = null
        }
        openTimeoutRef.current = setTimeout(() => {
          setOpen(true)
        }, openDelay)
      } else {
        if (openTimeoutRef.current) {
          clearTimeout(openTimeoutRef.current)
          openTimeoutRef.current = null
        }
        closeTimeoutRef.current = setTimeout(() => {
          setOpen(false)
        }, closeDelay)
      }
    },
    [openDelay, closeDelay]
  )

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
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </PopoverPrimitive.Root>
    </HoverCardContext.Provider>
  )
}

function HoverCardTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const { setOpen } = useHoverCard()

  return (
    <PopoverPrimitive.Trigger
      data-slot='hover-card-trigger'
      className={className}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </PopoverPrimitive.Trigger>
  )
}

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
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
      <PopoverPrimitive.Content
        data-slot='hover-card-content'
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-64 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
          className
        )}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
