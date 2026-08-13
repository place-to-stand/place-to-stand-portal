'use client'

import * as React from 'react'
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// Don't close the sheet when a press lands in a toast or inside another
// popup's portal (select/dropdown/popover/dialog content renders outside the
// sheet popup in the DOM and would otherwise read as an outside press).
const OUTSIDE_PRESS_ALLOWLIST =
  '[data-toast], [data-slot="select-content"], [data-slot="dropdown-menu-content"], [data-slot="popover-content"], [data-slot="tooltip-content"], [data-slot="dialog-content"], [data-slot="dialog-overlay"], [data-slot="alert-dialog-content"], [data-slot="alert-dialog-overlay"]'

const Sheet = ({
  onOpenChange,
  ...props
}: Omit<SheetPrimitive.Root.Props, 'children'> & {
  children?: React.ReactNode
}) => {
  const handleOpenChange = React.useCallback(
    (open: boolean, eventDetails: SheetPrimitive.Root.ChangeEventDetails) => {
      if (!open && eventDetails.reason === 'outside-press') {
        const target = eventDetails.event.target as HTMLElement | null
        if (target?.closest(OUTSIDE_PRESS_ALLOWLIST)) {
          eventDetails.cancel()
          return
        }
      }
      onOpenChange?.(open, eventDetails)
    },
    [onOpenChange]
  )

  return (
    <SheetPrimitive.Root
      data-slot='sheet'
      onOpenChange={handleOpenChange}
      {...props}
    />
  )
}

const SheetTrigger = ({
  asChild,
  children,
  ...props
}: SheetPrimitive.Trigger.Props & { asChild?: boolean }) => {
  if (asChild && React.isValidElement(children)) {
    return (
      <SheetPrimitive.Trigger
        data-slot='sheet-trigger'
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return (
    <SheetPrimitive.Trigger data-slot='sheet-trigger' {...props}>
      {children}
    </SheetPrimitive.Trigger>
  )
}

const SheetClose = ({
  asChild,
  children,
  ...props
}: SheetPrimitive.Close.Props & { asChild?: boolean }) => {
  if (asChild && React.isValidElement(children)) {
    return (
      <SheetPrimitive.Close
        data-slot='sheet-close'
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return (
    <SheetPrimitive.Close data-slot='sheet-close' {...props}>
      {children}
    </SheetPrimitive.Close>
  )
}

const SheetPortal = ({ ...props }: SheetPrimitive.Portal.Props) => {
  return <SheetPrimitive.Portal data-slot='sheet-portal' {...props} />
}

const SheetOverlay = ({
  className,
  ...props
}: SheetPrimitive.Backdrop.Props) => {
  return (
    <SheetPrimitive.Backdrop
      data-slot='sheet-overlay'
      className={cn(
        'pointer-events-auto data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  )
}

type SheetSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'wide' | 'xwide' | 'full'

const sheetSizeClasses: Record<SheetSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  wide: 'sm:max-w-4xl lg:max-w-5xl',
  xwide: 'sm:max-w-4xl lg:max-w-6xl',
  full: 'w-screen max-w-none',
}

const SheetContent = React.forwardRef<
  HTMLDivElement,
  SheetPrimitive.Popup.Props & {
    side?: 'top' | 'right' | 'bottom' | 'left'
    size?: SheetSize
    showOverlay?: boolean
    hideCloseButton?: boolean
    /**
     * Skip the open (mount) animation for this instance — for sheets that
     * remount already-open (e.g. a route-param change swapping the page while
     * the sheet is up), where replaying the slide-in reads as a flicker.
     * Close animations still play.
     */
    skipMountAnimation?: boolean
  }
>(
  (
    {
      className,
      children,
      side = 'right',
      size = 'sm',
      showOverlay = true,
      hideCloseButton = false,
      skipMountAnimation = false,
      ...props
    },
    ref
  ) => {
    const isHorizontal = side === 'left' || side === 'right'

    return (
      <SheetPortal>
        {showOverlay && (
          <SheetOverlay
            className={
              skipMountAnimation ? 'data-open:animate-none' : undefined
            }
          />
        )}
        <SheetPrimitive.Popup
          ref={ref}
          data-slot='sheet-content'
          className={cn(
            // Open and close both 300ms: the open used to run at 500ms, which
            // read as slower than the close it was paired with.
            'pointer-events-auto bg-background data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-closed:duration-300 data-open:duration-300',
            skipMountAnimation && 'data-open:animate-none',
            side === 'right' &&
              'data-closed:slide-out-to-right data-open:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l',
            side === 'left' &&
              'data-closed:slide-out-to-left data-open:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r',
            side === 'top' &&
              'data-closed:slide-out-to-top data-open:slide-in-from-top inset-x-0 top-0 h-auto border-b',
            side === 'bottom' &&
              'data-closed:slide-out-to-bottom data-open:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
            isHorizontal && sheetSizeClasses[size],
            className
          )}
          {...props}
        >
          {children}
          {!hideCloseButton && (
            <SheetPrimitive.Close className='ring-offset-background focus:ring-ring absolute top-3 right-3 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none'>
              <XIcon className='size-4' />
              <span className='sr-only'>Close</span>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Popup>
      </SheetPortal>
    )
  }
)
SheetContent.displayName = 'SheetContent'

const SheetHeader = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot='sheet-header'
      className={cn('flex flex-col gap-0.5 p-4 bg-muted/50', className)}
      {...props}
    />
  )
}

const SheetFooter = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot='sheet-footer'
      className={cn(
        'mt-auto flex flex-wrap items-center justify-end gap-3 p-4',
        className
      )}
      {...props}
    />
  )
}

const SheetTitle = ({ className, ...props }: SheetPrimitive.Title.Props) => {
  return (
    <SheetPrimitive.Title
      data-slot='sheet-title'
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

const SheetDescription = ({
  className,
  ...props
}: SheetPrimitive.Description.Props) => {
  return (
    <SheetPrimitive.Description
      data-slot='sheet-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
