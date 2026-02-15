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
}

export function TaskSheetHeader({ title, description, children }: TaskSheetHeaderProps) {
  return (
    <SheetHeader className='border-b-2 border-b-violet-500/60 px-6 pt-4'>
      <div className='flex items-center justify-between'>
        <SheetTitle>{title}</SheetTitle>
        {children}
      </div>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  )
}
