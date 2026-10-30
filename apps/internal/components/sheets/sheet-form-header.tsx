'use client'

import { type ReactNode } from 'react'
import { XIcon } from 'lucide-react'

import { SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ENTITY_ACCENTS, type AccentEntity } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

type SheetFormHeaderProps = {
  entity: AccentEntity
  title: string
  /** Before the title: the entity icon or the person's avatar. */
  leading?: ReactNode
  /** After the title: a state badge ("Client", a role). */
  badges?: ReactNode
  /** Right of the title, left of close: the record's actions menu. */
  menu?: ReactNode
  /** Rendered full-width below the title (e.g. lead action bar). */
  children?: ReactNode
  className?: string
}

export function SheetFormHeader({
  entity,
  title,
  leading,
  badges,
  menu,
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
      {leading || badges || menu ? (
        <div className='flex min-w-0 items-center gap-2'>
          {leading}
          <SheetTitle className='truncate text-base'>{title}</SheetTitle>
          {badges}
          {menu ? <div className='ml-auto shrink-0'>{menu}</div> : null}
        </div>
      ) : (
        <SheetTitle className='text-base'>{title}</SheetTitle>
      )}
      {children}
      <SheetClose className='text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset'>
        <XIcon className='size-4' />
        <span className='sr-only'>Close</span>
      </SheetClose>
    </SheetHeader>
  )
}
