'use client'

import { type ReactNode } from 'react'
import { XIcon } from 'lucide-react'

import { SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ENTITY_ACCENTS, type AccentEntity } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

type SheetFormHeaderProps = {
  entity: AccentEntity
  title: string
  /** Rendered full-width below the title (e.g. lead action bar). */
  children?: ReactNode
  className?: string
}

export function SheetFormHeader({
  entity,
  title,
  children,
  className,
}: SheetFormHeaderProps) {
  return (
    <SheetHeader
      className={cn(
        ENTITY_ACCENTS[entity].sheetHeader,
        'relative p-2.5 pr-12',
        className
      )}
    >
      <SheetTitle className='text-base'>{title}</SheetTitle>
      {children}
      <SheetClose className='text-muted-foreground hover:text-foreground hover:bg-muted/60 focus:ring-ring absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center transition-colors focus:ring-2 focus:outline-hidden'>
        <XIcon className='size-4' />
        <span className='sr-only'>Close</span>
      </SheetClose>
    </SheetHeader>
  )
}
