'use client'

import { useRouter } from 'next/navigation'

import { UserSheet } from '@/app/(dashboard)/settings/users/components/sheet/user-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function UserSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('user', value)

  if (!data) {
    return null
  }

  return (
    <UserSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('user')
        }
      }}
      onComplete={() => {
        router.refresh()
        close('user')
      }}
      user={data.user}
      currentUserId={data.currentUserId}
      assignments={data.assignments}
    />
  )
}
