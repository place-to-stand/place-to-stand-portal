'use client'

import { useCallback, useTransition } from 'react'

import { useToast } from '@/components/ui/use-toast'
import { promoteContactToUser } from '@/app/(dashboard)/people/actions'

type PortalUserTarget = {
  id: string
  name: string | null
  email: string | null
}

/**
 * Creates a contact's client portal user (and emails them a one-time
 * sign-in link), with the shared toasts. Used by the contact sheet, the
 * contacts list row action and Edit client > Portal access, behind the
 * same PromoteToUserDialog.
 */
export function useCreatePortalUser() {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const createPortalUser = useCallback(
    (
      contact: PortalUserTarget,
      handlers: {
        onSuccess?: () => void
        onError?: (message: string) => void
      } = {}
    ) => {
      startTransition(async () => {
        const result = await promoteContactToUser(contact.id)

        if (result.error) {
          handlers.onError?.(result.error)
          toast({
            title: 'Unable to create portal user',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Portal user created',
          description: `A sign-in link to the client portal has been emailed to ${contact.name || contact.email || 'the person'}.`,
        })
        handlers.onSuccess?.()
      })
    },
    [toast]
  )

  return { createPortalUser, isPending }
}
