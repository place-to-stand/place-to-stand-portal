'use client'

import { useState, type ReactNode } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type BreakdownSheetProps = {
  trigger: ReactNode
  title: string
  description: string
  children: ReactNode
}

export function BreakdownSheet({
  trigger,
  title,
  description,
  children,
}: BreakdownSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side='right' size='lg' className='overflow-y-auto p-0 [&>[data-slot=sheet-close]]:z-20'>
        <SheetHeader className='sticky top-0 z-10 border-b pr-10'>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className='space-y-6 p-4'>{children}</div>
      </SheetContent>
    </Sheet>
  )
}
