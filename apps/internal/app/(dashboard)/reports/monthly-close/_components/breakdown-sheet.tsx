'use client'

import { ArrowRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@pts/ui/button'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type BreakdownSheetProps = {
  /**
   * The link-style trigger's text. The button is built here, in the client
   * component, rather than passed in: a Button rendered by the server page
   * crosses the boundary as finished output and no longer matches the
   * trigger the client renders, which fails hydration.
   */
  triggerLabel: string
  title: string
  description: string
  children: ReactNode
}

export function BreakdownSheet({
  triggerLabel,
  title,
  description,
  children,
}: BreakdownSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant='link'
            size='xs'
            className='text-muted-foreground hover:text-foreground'
          />
        }
      >
        {triggerLabel}
        <ArrowRight />
      </SheetTrigger>
      <SheetContent
        side='right'
        size='lg'
        className='overflow-y-auto p-0 [&>[data-slot=sheet-close]]:z-20'
      >
        <SheetHeader className='sticky top-0 z-10 border-b pr-10'>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className='space-y-6 p-4'>{children}</div>
      </SheetContent>
    </Sheet>
  )
}
