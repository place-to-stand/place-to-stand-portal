'use client'

import { type ReactNode } from 'react'

import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type ContactSheetHeaderProps = {
  title: string
  description: ReactNode
}

export function ContactSheetHeader({
  title,
  description,
}: ContactSheetHeaderProps) {
  return (
    <SheetHeader className='border-b-2 border-b-cyan-500/60 px-6 pt-4'>
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  )
}
