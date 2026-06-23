'use client'

import { type ReactNode } from 'react'

import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type TaskSheetHeaderProps = {
  title: string
  description: ReactNode
  children?: ReactNode
  descriptionAction?: ReactNode
}

export function TaskSheetHeader({
  title,
  description,
  children,
  descriptionAction,
}: TaskSheetHeaderProps) {
  return (
    <SheetHeader className='border-b-2 border-b-violet-500/60 px-6 pt-4'>
      <div className='flex items-start justify-between'>
        <SheetTitle>{title}</SheetTitle>
        {children}
      </div>
      <div className='flex items-center justify-between gap-2'>
        <SheetDescription>{description}</SheetDescription>
        {descriptionAction}
      </div>
    </SheetHeader>
  )
}
