'use client'

import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, XIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
}: FilterSheetButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type='button'
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          hideCloseButton
          size='sm'
          className='flex flex-col gap-0 overflow-hidden p-0'
        >
          <SheetHeader className='relative border-b p-2.5 pr-12'>
            <SheetTitle className='text-base'>Filters</SheetTitle>
            <SheetClose className='text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset'>
              <XIcon className='size-4' />
              <span className='sr-only'>Close</span>
            </SheetClose>
          </SheetHeader>
          {/* Every control fills the row: the triggers carry their toolbar
              widths (w-40 and the like), which read as stray in a sheet. */}
          <div className='flex flex-1 flex-col gap-3 overflow-y-auto p-4 [&>*]:w-full [&>*]:max-w-none'>
            {children}
          </div>
          <SheetFooterBar>
            {onReset && activeCount > 0 ? (
              <Button
                type='button'
                variant='ghost'
                className='text-muted-foreground hover:text-foreground'
                onClick={onReset}
              >
                Reset
              </Button>
            ) : (
              <span />
            )}
            <Button type='button' onClick={() => setOpen(false)}>
              Done
            </Button>
          </SheetFooterBar>
        </SheetContent>
      </Sheet>
    </>
  )
}
