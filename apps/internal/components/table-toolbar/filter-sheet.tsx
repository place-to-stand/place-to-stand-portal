'use client'

import { useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetFooterBar } from '@/components/sheets/sheet-form-footer'
import { cn } from '@/lib/utils'

type FilterSheetButtonProps = {
  /** The filter controls; they render full width, one per row. */
  children: ReactNode
  /** Non-default filters, shown as a count on the button. */
  activeCount?: number
  /** Clears every filter; the sheet offers it only while `activeCount` > 0. */
  onReset?: () => void
  className?: string
  /** Told when the sheet opens or closes. */
  onOpenChange?: (open: boolean) => void
}

/**
 * The phone home for a toolbar's filters: a "Filters" button that opens them
 * in a right-side sheet, so the search keeps its row instead of stacking
 * every select beneath it. Filters still apply as they change (they are URL
 * params); Done just closes the sheet.
 */
export function FilterSheetButton({
  children,
  activeCount = 0,
  onReset,
  className,
  onOpenChange,
}: FilterSheetButtonProps) {
  const [open, setOpenState] = useState(false)
  // Opening reports at once; closing only once the sheet has finished
  // closing and handed focus back to the button.
  const setOpen = (next: boolean) => {
    setOpenState(next)
    if (next) onOpenChange?.(true)
  }

  return (
    <>
      <Button
        type='button'
        data-slot='filter-sheet-button'
        variant='outline'
        className={cn('shrink-0', className)}
        onClick={() => setOpen(true)}
        aria-label={
          activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'
        }
      >
        <SlidersHorizontal />
        Filters
        {activeCount > 0 ? (
          <span className='bg-primary text-primary-foreground rounded-full px-1.5 text-xs leading-5 tabular-nums'>
            {activeCount}
          </span>
        ) : null}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={stillOpen => {
          // Two frames on, so the sheet has handed focus back first.
          if (!stillOpen) {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => onOpenChange?.(false))
            )
          }
        }}
      >
        <SheetContent
          hideCloseButton
          columns='narrow'
          className='flex flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            title='Filters'
            leading={
              <SlidersHorizontal
                aria-hidden
                className='text-muted-foreground size-4 shrink-0'
              />
            }
          />
          {/* Every control fills the row: the triggers carry their toolbar
              widths (w-40 and the like), which read as stray in a sheet. */}
          <div className='flex flex-1 flex-col gap-3 overflow-y-auto p-4 [&>*]:w-full [&>*]:max-w-none'>
            {children}
          </div>
          <SheetFooterBar>
            {onReset && activeCount > 0 ? (
              <Button
                type='button'
                variant='outline'
                size='xs'
                onClick={onReset}
              >
                Reset
              </Button>
            ) : (
              <span />
            )}
            {/* xs, the height of every sheet footer's buttons. */}
            <Button type='button' size='xs' onClick={() => setOpen(false)}>
              Done
            </Button>
          </SheetFooterBar>
        </SheetContent>
      </Sheet>
    </>
  )
}
