'use client'

import { useEffect, useMemo, useState } from 'react'
import { Send } from 'lucide-react'

import { invoiceEmail } from '@pts/email/templates'
import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { Skeleton } from '@pts/ui/skeleton'
import {
  RecipientField,
  type RecipientOption,
} from '@/components/email/recipient-field'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { InvoiceEmailDraft } from '@/lib/invoices/send/email'

import { emailInvoice, getInvoiceEmailDraft } from '../actions'

type InvoiceEmailDialogProps = {
  invoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After Resend accepted the message; `markedSent` when a draft became SENT. */
  onSent: (result: { invoiceNumber: string; markedSent: boolean }) => void
}

type Loaded = { draft: InvoiceEmailDraft; requestId: string }

/**
 * Compose and send an invoice email, mail-client style: recipients as chips,
 * subject and note on the left, and the email exactly as it will arrive on
 * the right, re-rendered on every keystroke. The dialog is mounted fresh per
 * open, so each open is one idempotent request. Closing without sending asks
 * first once anything differs from the draft it opened with.
 */
export function InvoiceEmailDialog({
  invoiceId,
  open,
  onOpenChange,
  onSent,
}: InvoiceEmailDialogProps) {
  const [sending, setSending] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const { requestConfirmation, dialog: discardDialog } =
    useUnsavedChangesWarning({
      isDirty,
      title: 'Discard this email?',
      description:
        'Your changes to the recipients and message will be lost. The invoice stays as it is.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    })

  // Every way out — ×, Esc, the backdrop, Cancel — goes through here.
  const requestClose = () => requestConfirmation(() => onOpenChange(false))

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (sending) return
          if (next) onOpenChange(true)
          else requestClose()
        }}
      >
        <DialogContent className='flex h-[min(716px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1040px]'>
          {open ? (
            <InvoiceEmailForm
              invoiceId={invoiceId}
              sending={sending}
              setSending={setSending}
              onDirtyChange={setIsDirty}
              onCancel={requestClose}
              onSent={onSent}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {discardDialog}
    </>
  )
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(item => b.includes(item))
}

function InvoiceEmailForm({
  invoiceId,
  sending,
  setSending,
  onDirtyChange,
  onCancel,
  onSent,
}: {
  invoiceId: string
  sending: boolean
  setSending: (sending: boolean) => void
  onDirtyChange: (dirty: boolean) => void
  onCancel: () => void
  onSent: InvoiceEmailDialogProps['onSent']
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [to, setTo] = useState<string[]>([])
  const [cc, setCc] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [triedSend, setTriedSend] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getInvoiceEmailDraft(invoiceId).then(result => {
      if (cancelled) return
      if (!result.ok) {
        setLoadError(result.error)
        return
      }
      const draft = result.data
      setLoaded({ draft, requestId: crypto.randomUUID() })
      setTo(draft.to)
      setCc(draft.cc)
      setSubject(draft.subject)
      setMessage(draft.message)
    })
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  const draft = loaded?.draft

  const dirty =
    draft !== undefined &&
    (subject !== draft.subject ||
      message !== draft.message ||
      !sameList(to, draft.to) ||
      !sameList(cc, draft.cc))

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Unmounted on close or after a send: nothing is left to discard.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const contactOptions = useMemo<RecipientOption[]>(
    () => draft?.contacts ?? [],
    [draft]
  )
  const staffOptions = useMemo<RecipientOption[]>(
    () =>
      (draft?.staff ?? []).map(member => ({
        ...member,
        name:
          member.email === draft?.senderEmail
            ? `${member.name} (you)`
            : member.name,
      })),
    [draft]
  )

  // The send renders this same template on the server, so what's shown here
  // is what arrives.
  const previewHtml = useMemo(
    () =>
      draft ? invoiceEmail({ ...draft.facts, subject, message }).html : null,
    [draft, subject, message]
  )

  const handleSend = async () => {
    if (!loaded) return
    setTriedSend(true)
    if (to.length === 0) return
    setError(null)
    setSending(true)
    try {
      const result = await emailInvoice({
        id: invoiceId,
        to,
        cc,
        subject,
        message,
        requestId: loaded.requestId,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSent(result.data)
    } catch {
      setError('Unable to send invoice email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <DialogHeader className='border-b px-6 pt-6 pr-14 pb-5'>
        <DialogTitle>
          {draft?.isResend ? 'Email invoice ' : 'Send invoice '}
          {draft ? (
            <span className='font-mono font-medium'>{draft.invoiceNumber}</span>
          ) : null}
          {draft?.isResend ? ' again' : null}
        </DialogTitle>
        <DialogDescription>
          {draft ? (
            <>
              {draft.isResend ? 'Sends ' : 'Emails '}
              {draft.clientName}
              {draft.isResend
                ? ' a reminder with the link to pay '
                : ' a link to view and pay '}
              <span className='text-foreground tabular-nums'>
                {draft.amountDue}
              </span>
              {draft.isResend
                ? '. The status stays the same.'
                : ', then marks the invoice as sent.'}
            </>
          ) : (
            'Loading the invoice…'
          )}
        </DialogDescription>
      </DialogHeader>

      {loadError ? (
        <p className='text-destructive flex-1 px-6 py-5 text-sm'>{loadError}</p>
      ) : !draft ? (
        <div className='flex-1 space-y-3 px-6 py-5'>
          <Skeleton className='h-9 w-2/5' />
          <Skeleton className='h-9 w-1/3' />
          <Skeleton className='h-40 w-full' />
        </div>
      ) : (
        <div className='grid min-h-0 flex-1 md:grid-cols-[480px_minmax(0,1fr)]'>
          <div className='flex min-h-0 flex-col md:border-r'>
            <RecipientField
              label='To'
              options={contactOptions}
              groupHeading={`${draft.clientName} contacts`}
              searchPlaceholder='Search contacts or type an email'
              value={to}
              onChange={setTo}
              allowTyped
              error={
                triedSend && to.length === 0
                  ? 'Add at least one recipient'
                  : null
              }
              disabled={sending}
            />
            <RecipientField
              label='Cc'
              options={staffOptions}
              groupHeading='Team'
              searchPlaceholder='Search the team'
              value={cc}
              onChange={setCc}
              disabled={sending}
            />
            <label className='flex min-h-13 items-center gap-3 border-b px-6'>
              <span className='text-muted-foreground w-13 shrink-0 text-sm'>
                Subject
              </span>
              <input
                value={subject}
                onChange={event => setSubject(event.target.value)}
                disabled={sending}
                className='h-9 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none'
              />
            </label>
            <label className='flex min-h-0 flex-1 flex-col px-6 pt-4 pb-5'>
              <span className='sr-only'>Message</span>
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value)}
                disabled={sending}
                className='min-h-40 flex-1 resize-none bg-transparent text-sm leading-[22px] outline-none'
              />
            </label>
          </div>

          <div className='bg-email-backdrop hidden min-h-0 flex-col md:flex'>
            <div className='border-email-rule flex h-10 shrink-0 items-center justify-between gap-3 border-b px-5'>
              <span className='text-email-muted text-[11px] font-semibold tracking-wide uppercase'>
                Preview
              </span>
              <span className='text-email-faint truncate text-xs'>
                {to.length ? `To ${to.join(', ')}` : 'No recipients yet'}
              </span>
            </div>
            {previewHtml ? (
              <iframe
                title='Invoice email preview'
                srcDoc={previewHtml}
                sandbox=''
                className='min-h-0 w-full flex-1'
              />
            ) : null}
          </div>
        </div>
      )}

      <DialogFooter className='items-center border-t px-6 py-4 sm:justify-between'>
        {error ? (
          <p className='text-destructive text-xs'>{error}</p>
        ) : (
          <p className='text-muted-foreground text-xs'>
            From Place To Stand · replies go to you
          </p>
        )}
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={handleSend}
            disabled={sending || !draft}
          >
            <Send />
            {sending
              ? 'Sending...'
              : draft?.isResend
                ? 'Send email'
                : 'Send invoice'}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
