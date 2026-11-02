'use client'

import { ContactSheetWrapper } from './contact-sheet-wrapper'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

/** Old `?user=<id>` links open that person's sheet (their sign-in is there). */
export function UserSheetWrapper({
  value,
  open,
  stack,
  onRequestClose,
}: SheetWrapperProps) {
  const data = useSheetInit('user', value)
  if (!data?.contactId) return null
  return (
    <ContactSheetWrapper
      value={data.contactId}
      open={open}
      stack={stack}
      onRequestClose={onRequestClose}
    />
  )
}
