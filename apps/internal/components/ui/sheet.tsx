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
        'data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards data-closed:fade-out-0 data-open:fade-in-0 pointer-events-auto fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  )
}

/**
 * A sheet's width follows its layout: `columns={1}` (one column: company,
 * person, task, project, hour block, submission, template, filters) is 720px,
 * which fits the full rich text toolbar on one line with room to spare;
 * `columns={2}` (a form beside a SHEET_SIDE_COLUMN_CLASS column: lead,
 * invoice) is 768px below lg and a set 1184px from lg, within the viewport.
 * Below lg a side column stacks under the form. Phones get the full screen
 * either way.
 */
export type SheetColumns = 1 | 2

/** The one-column sheet width, for layouts that add to it (task planning). */
export const SHEET_ONE_COLUMN_WIDTH = 720

const sheetColumnClasses: Record<SheetColumns, string> = {
  1: 'sm:max-w-[720px]',
  2: 'sm:max-w-3xl lg:w-[1184px] lg:max-w-[calc(100vw-4rem)]',
}

const SheetContent = React.forwardRef<
  HTMLDivElement,
  SheetPrimitive.Popup.Props & {
    side?: 'top' | 'right' | 'bottom' | 'left'
    /** One column or a form beside a side column; sets the width. */
    columns?: SheetColumns
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
      columns = 1,
      showOverlay = true,
      hideCloseButton = false,
      skipMountAnimation = false,
      ...props
    },
    ref
  ) => {
    const isHorizontal = side === 'left' || side === 'right'
    const popupRef = React.useRef<HTMLDivElement | null>(null)
    const setPopupRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        popupRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )
    // Land focus on the sheet's `data-autofocus` field when it has one, else
    // on the popup itself — never on its first tabbable (the header's close
    // button), which stays one Tab away.
    const focusPopup = React.useCallback(() => {
      const popup = popupRef.current
      if (!popup) {
        return null
      }
      return (
        popup.querySelector<HTMLElement>('[data-autofocus]:not([disabled])') ??
        popup
      )
    }, [])

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
          ref={setPopupRef}
          initialFocus={focusPopup}
          data-slot='sheet-content'
          className={cn(
            // Open and close both 300ms: the open used to run at 500ms, which
            // read as slower than the close it was paired with.
            'bg-background data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards pointer-events-auto fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-closed:duration-300 data-open:duration-300',
            skipMountAnimation && 'data-open:animate-none',
            // Entity sheets take the whole phone screen: at 3/4 of a 375px
            // viewport their forms and editors were too cramped to use.
            side === 'right' &&
              'data-closed:slide-out-to-right data-open:slide-in-from-right inset-y-0 right-0 h-full w-full border-l sm:w-3/4',
            side === 'left' &&
              'data-closed:slide-out-to-left data-open:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r',
            side === 'top' &&
              'data-closed:slide-out-to-top data-open:slide-in-from-top inset-x-0 top-0 h-auto border-b',
            side === 'bottom' &&
              'data-closed:slide-out-to-bottom data-open:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
            isHorizontal && sheetColumnClasses[columns],
            className
          )}
          {...props}
        >
          {children}
          {!hideCloseButton && (
            <SheetPrimitive.Close className='focus-visible:ring-ring/50 absolute top-3 right-3 rounded-xs opacity-70 transition-opacity outline-none hover:opacity-100 focus-visible:ring-[3px] disabled:pointer-events-none'>
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
      className={cn('bg-muted/50 flex flex-col gap-0.5 p-4', className)}
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

/**
 * Width of the side column in a two-column sheet (the lead's tasks
 * and updates, the invoice's status and actions).
 */
export const SHEET_SIDE_COLUMN_CLASS = 'lg:w-96'
