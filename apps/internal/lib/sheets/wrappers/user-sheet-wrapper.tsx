'use client'

import { useRouter } from 'next/navigation'

import { UserSheet } from '@/app/(dashboard)/settings/users/components/sheet/user-sheet'

import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function UserSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('user', value)

  if (!data) {
    return null
  }

  return (
    <UserSheet
      open={open}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
        }
      }}
      onComplete={() => {
        router.refresh()
        onRequestClose()
      }}
      user={data.user}
      currentUserId={data.currentUserId}
      assignments={data.assignments}
    />
  )
}
