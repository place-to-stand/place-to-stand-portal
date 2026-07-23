import { useMemo } from 'react'

import { PENDING_REASON } from './constants'
import type { UserRow, UserRowState } from './types'

type UseUserRowsStateArgs = {
  users: UserRow[]
  currentUserId: string
  isPending: boolean
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  pendingDisableId: string | null
  editUser: (user: UserRow) => void
  restoreUser: (user: UserRow) => void
  requestDelete: (user: UserRow) => void
  requestDestroy: (user: UserRow) => void
  setUserDisabled: (user: UserRow, disabled: boolean) => void
  selfDeleteReason: string
}

const SELF_DISABLE_REASON = 'You cannot disable your own account.'

export const useUserRowsState = ({
  users,
  currentUserId,
  isPending,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  pendingDisableId,
  editUser,
  restoreUser,
  requestDelete,
  requestDestroy,
  setUserDisabled,
  selfDeleteReason,
}: UseUserRowsStateArgs): UserRowState[] => {
  return useMemo(
    () =>
      users.map(user => {
        const isDeleting = isPending && pendingDeleteId === user.id
        const isRestoring = isPending && pendingRestoreId === user.id
        const isDestroying = isPending && pendingDestroyId === user.id
        const isTogglingAccess = isPending && pendingDisableId === user.id
        const rowBusy =
          isDeleting || isRestoring || isDestroying || isTogglingAccess

        const deleteDisabled =
          rowBusy || user.id === currentUserId || Boolean(user.deleted_at)
        const restoreDisabled = rowBusy
        const editDisabled = rowBusy

        const deleteDisabledReason = deleteDisabled
          ? rowBusy
            ? PENDING_REASON
            : user.id === currentUserId
              ? selfDeleteReason
              : null
          : null

        const destroyDisabled = rowBusy || !user.deleted_at
        const destroyDisabledReason = destroyDisabled
          ? !user.deleted_at
            ? 'Archive the user before permanently deleting.'
            : PENDING_REASON
          : null

        const accessToggleDisabled = rowBusy || user.id === currentUserId
        const accessToggleDisabledReason = accessToggleDisabled
          ? rowBusy
            ? PENDING_REASON
            : SELF_DISABLE_REASON
          : null

        return {
          user,
          isDeleting,
          isRestoring,
          isDestroying,
          isTogglingAccess,
          accessEnabled: !user.disabled_at,
          accessToggleDisabled,
          accessToggleDisabledReason,
          onToggleAccess: (enabled: boolean) => setUserDisabled(user, !enabled),
          deleteDisabled,
          deleteDisabledReason,
          restoreDisabled,
          restoreDisabledReason: restoreDisabled ? PENDING_REASON : null,
          editDisabled,
          editDisabledReason: editDisabled ? PENDING_REASON : null,
          onEdit: () => editUser(user),
          onRestore: () => restoreUser(user),
          onRequestDelete: () => requestDelete(user),
          destroyDisabled,
          destroyDisabledReason,
          onRequestDestroy: () => requestDestroy(user),
        }
      }),
    [
      currentUserId,
      editUser,
      isPending,
      pendingDeleteId,
      pendingDestroyId,
      pendingDisableId,
      pendingRestoreId,
      requestDelete,
      requestDestroy,
      restoreUser,
      selfDeleteReason,
      setUserDisabled,
      users,
    ]
  )
}
