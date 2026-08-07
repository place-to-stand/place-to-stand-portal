import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import { setUserDisabled } from '@/app/(dashboard)/settings/users/actions'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import type { UserRow } from '../types'

type UseSetUserDisabledActionReturn = {
  setDisabled: (user: UserRow, disabled: boolean) => void
  pendingDisableId: string | null
  isPending: boolean
}

export function useSetUserDisabledAction(): UseSetUserDisabledActionReturn {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingDisableId, setPendingDisableId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSetDisabled = useCallback(
    (user: UserRow, disabled: boolean) => {
      setPendingDisableId(user.id)
      startTransition(async () => {
        const interaction = startSettingsInteraction({
          entity: 'user',
          mode: 'edit',
          targetId: user.id,
          metadata: {
            email: user.email,
            role: user.role,
            disabled,
          },
        })

        try {
          const result = await setUserDisabled({ id: user.id, disabled })

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              targetId: user.id,
              error: result.error,
            })
            toast({
              title: 'Unable to update access',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: user.id,
          })

          const displayName = user.full_name ?? user.email
          toast({
            title: disabled ? 'Access disabled' : 'Access enabled',
            description: disabled
              ? `${displayName} can no longer sign in to the portal.`
              : `${displayName} can sign in to the portal again.`,
          })
          router.refresh()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          toast({
            title: 'Unable to update access',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
          })
        } finally {
          setPendingDisableId(null)
        }
      })
    },
    [router, startTransition, toast],
  )

  return {
    setDisabled: handleSetDisabled,
    pendingDisableId,
    isPending,
  }
}
