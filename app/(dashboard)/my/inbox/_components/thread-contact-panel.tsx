'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Contact,
  UserPlus,
  Loader2,
  Building2,
  Pencil,
  Phone,
  Mail,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ContactsSheet } from '@/app/(dashboard)/contacts/_components/contacts-sheet'

type ContactCheckResult = {
  email: string
  name: string | null
  contact: {
    id: string
    name: string
    email: string
    phone: string | null
    linkedClients: Array<{
      id: string
      name: string
      isPrimary: boolean
    }>
  } | null
}

type ThreadContactPanelProps = {
  threadId: string
  participantEmails: string[]
  onContactAdded?: (contactId: string, email: string) => void
}

export function ThreadContactPanel({
  threadId,
  participantEmails,
  onContactAdded,
}: ThreadContactPanelProps) {
  const [results, setResults] = useState<ContactCheckResult[]>([])
  const [loadedThreadId, setLoadedThreadId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // For new contacts: id = '' (empty string)
  // For existing contacts: id = actual UUID
  const [contactForSheet, setContactForSheet] = useState<{
    id: string
    email: string
    name: string
    phone: string | null
  } | null>(null)

  // Derive loading state: we're loading if we have a valid threadId but haven't loaded it yet
  const isLoading =
    threadId && participantEmails.length > 0 && loadedThreadId !== threadId

  // Fetch contact check data when thread changes
  useEffect(() => {
    if (!threadId || participantEmails.length === 0) {
      return
    }

    let cancelled = false

    fetch(`/api/threads/${threadId}/contacts-check`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          if (data.ok) {
            setResults(data.results || [])
          }
          setLoadedThreadId(threadId)
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to check contacts:', err)
          setResults([])
          setLoadedThreadId(threadId)
        }
      })

    return () => {
      cancelled = true
    }
  }, [threadId, participantEmails])

  const unknownContacts = results.filter(r => !r.contact)
  const knownContacts = results.filter(r => r.contact)

  const handleOpenAddSheet = (result: ContactCheckResult) => {
    setContactForSheet({
      id: '', // Empty = new contact
      email: result.email.toLowerCase().trim(),
      name:
        result.name ||
        result.email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase()),
      phone: null,
    })
    setSheetOpen(true)
  }

  const handleOpenEditSheet = (result: ContactCheckResult) => {
    if (!result.contact) return
    setContactForSheet({
      id: result.contact.id,
      email: result.contact.email,
      name: result.contact.name,
      phone: result.contact.phone,
    })
    setSheetOpen(true)
  }

  const handleSheetComplete = useCallback(() => {
    setSheetOpen(false)
    // Refresh the contact check results
    if (threadId) {
      fetch(`/api/threads/${threadId}/contacts-check`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setResults(data.results || [])
          }
        })
        .catch(err => {
          console.error('Failed to refresh contacts:', err)
        })
    }
  }, [threadId])

  const handleContactCreated = useCallback(
    (contactId: string) => {
      if (contactForSheet && !contactForSheet.id) {
        // Only call onContactAdded for new contacts, not edits
        onContactAdded?.(contactId, contactForSheet.email)
      }
    },
    [contactForSheet, onContactAdded]
  )

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Contact className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Contacts</span>
        </div>
        <div className='bg-muted/30 flex items-center gap-2 rounded-lg border p-3'>
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
          <span className='text-muted-foreground text-sm'>
            Checking contacts...
          </span>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className='space-y-4'>
      {/* Section Header */}
      <div className='flex items-center gap-2'>
        <Contact className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Contacts</span>
      </div>

      {/* Known Contacts */}
      {knownContacts.length > 0 && (
        <div className='space-y-2'>
          {knownContacts.map(r => (
            <div key={r.email} className='bg-muted/30 rounded-lg border p-2.5'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Contact className='h-3.5 w-3.5 text-cyan-500' />
                  <span className='text-sm font-medium'>{r.contact!.name}</span>
                </div>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 w-7 p-0'
                  onClick={() => handleOpenEditSheet(r)}
                >
                  <Pencil className='h-3 w-3' />
                </Button>
              </div>
              <a
                href={`mailto:${r.contact!.email}`}
                className='text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1 truncate text-xs transition-colors'
              >
                <Mail className='h-3 w-3 shrink-0' />
                {r.contact!.email}
              </a>
              {r.contact!.phone && (
                <a
                  href={`tel:${r.contact!.phone}`}
                  className='text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1 text-xs transition-colors'
                >
                  <Phone className='h-3 w-3 shrink-0' />
                  {r.contact!.phone}
                </a>
              )}
              {r.contact!.linkedClients.length > 0 && (
                <div className='mt-2 flex flex-wrap gap-1'>
                  {r.contact!.linkedClients.map(client => (
                    <Badge
                      key={client.id}
                      variant='secondary'
                      className='text-xs'
                    >
                      <Building2 className='mr-1 h-2.5 w-2.5' />
                      {client.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unknown Contacts - Offer to Add */}
      {unknownContacts.length > 0 && (
        <div className='space-y-2'>
          <p className='text-muted-foreground text-xs'>Not in contacts:</p>
          {unknownContacts.map(r => (
            <div
              key={r.email}
              className='flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950/20'
            >
              <span className='max-w-[180px] truncate text-sm' title={r.email}>
                {r.email}
              </span>
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 text-xs'
                onClick={() => handleOpenAddSheet(r)}
              >
                <UserPlus className='mr-1 h-3 w-3' />
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Sheet - reuses the contacts sheet from /contacts */}
      <ContactsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleSheetComplete}
        onCreated={handleContactCreated}
        contact={contactForSheet}
      />
    </div>
  )
}
