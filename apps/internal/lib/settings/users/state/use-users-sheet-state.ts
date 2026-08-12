import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'

import type { SheetState, UserRow } from './types'

type UsersSheetController = {
  sheet: SheetState
  openCreate: () => void
  editUser: (user: UserRow) => void
}

type UseUsersSheetStateArgs = {
  /** The page's fresh rows — the open sheet re-resolves from them by id. */
  users?: UserRow[]
  /** Row resolved server-side from `?user=`, when the page's list misses it. */
  deepLinkedUser?: UserRow | null
}

export const useUsersSheetState = ({
  users,
  deepLinkedUser = null,
}: UseUsersSheetStateArgs = {}): UsersSheetController => {
  const router = useRouter()
  // `?user=` drives the sheet so an open user is a shareable link.
  const { selectedId, isCreating, select, openCreate, clear } =
    useSheetParamSelection('user')

  const selectedUser: UserRow | null = selectedId
    ? (users?.find(user => user.id === selectedId) ??
      (deepLinkedUser?.id === selectedId ? deepLinkedUser : null))
    : null

  // Keep the last-opened user rendered while the sheet animates closed.
  const [lastOpenedUser, setLastOpenedUser] = useState<UserRow | null>(null)
  if (isCreating) {
    if (lastOpenedUser !== null) {
      setLastOpenedUser(null)
    }
  } else if (selectedUser && selectedUser !== lastOpenedUser) {
    setLastOpenedUser(selectedUser)
  }

  const handleSheetComplete = useCallback(() => {
    clear()
    void router.refresh()
  }, [clear, router])

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        clear()
      }
    },
    [clear]
  )

  const handleEdit = useCallback(
    (user: UserRow) => {
      select(user.id)
    },
    [select]
  )

  const sheet: SheetState = {
    open: isCreating || Boolean(selectedUser),
    selectedUser: isCreating ? null : (selectedUser ?? lastOpenedUser),
    onOpenChange: handleSheetOpenChange,
    onComplete: handleSheetComplete,
  }

  return {
    sheet,
    openCreate,
    editUser: handleEdit,
  }
}
