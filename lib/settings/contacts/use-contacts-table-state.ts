'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import {
  destroyContact,
  restoreContact,
  softDeleteContact,
} from '@/app/(dashboard)/contacts/actions'
import type { LinkedClient } from '@/lib/queries/contacts'

export type ContactsTab = 'contacts' | 'archive' | 'activity'

export type ContactsTableContact = {
  id: string
  email: string
  name: string
  phone: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  metrics: {
    totalClients: number
    clients: LinkedClient[]
  }
}

export function useContactsTableState() {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedContact, setSelectedContact] =
    useState<ContactsTableContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContactsTableContact | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] = useState<ContactsTableContact | null>(
    null
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const pendingReason = 'Please wait for the current request to finish.'

  const openCreate = () => {
    setSelectedContact(null)
    setSheetOpen(true)
  }

  const openEdit = (contact: ContactsTableContact) => {
    setSelectedContact(contact)
    setSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setSelectedContact(null)
    }
  }

  const handleSheetComplete = () => {
    setSheetOpen(false)
    setSelectedContact(null)
    router.refresh()
  }

  const handleRequestDelete = (contact: ContactsTableContact) => {
    if (contact.deletedAt || isPending) {
      return
    }

    setDeleteTarget(contact)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deletedAt) {
      setDeleteTarget(null)
      return
    }

    const contact = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(contact.id)

    startTransition(async () => {
      try {
        const result = await softDeleteContact({ id: contact.id })

        if (result.error) {
          toast({
            title: 'Unable to archive contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Contact archived',
          description: `${contact.name || contact.email} has been archived.`,
        })
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (contact: ContactsTableContact) => {
    if (!contact.deletedAt || isPending) {
      return
    }

    setPendingRestoreId(contact.id)
    startTransition(async () => {
      try {
        const result = await restoreContact({ id: contact.id })

        if (result.error) {
          toast({
            title: 'Unable to restore contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Contact restored',
          description: `${contact.name || contact.email} is active again.`,
        })
        router.refresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (contact: ContactsTableContact) => {
    if (!contact.deletedAt || isPending) {
      return
    }

    setDestroyTarget(contact)
  }

  const handleCancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deletedAt) {
      setDestroyTarget(null)
      return
    }

    const contact = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(contact.id)

    startTransition(async () => {
      try {
        const result = await destroyContact({ id: contact.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Contact permanently deleted',
          description: `${contact.name || contact.email} has been removed.`,
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return {
    sheetOpen,
    selectedContact,
    deleteTarget,
    destroyTarget,
    isPending,
    pendingReason,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    openCreate,
    openEdit,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRestore,
    handleRequestDestroy,
    handleCancelDestroy,
    handleConfirmDestroy,
  }
}
