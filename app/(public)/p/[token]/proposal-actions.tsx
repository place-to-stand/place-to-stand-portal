'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type ProposalActionsProps = {
  token: string
  status: string
  acceptedAt: string | null
  rejectedAt: string | null
  clientComment: string | null
}

export function ProposalActions({
  token,
  status,
  acceptedAt,
  rejectedAt,
  clientComment,
}: ProposalActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [comment, setComment] = useState('')
  const [responseStatus, setResponseStatus] = useState(status)
  const [responseComment, setResponseComment] = useState(clientComment)

  const alreadyResponded = Boolean(acceptedAt || rejectedAt)

  async function handleRespond(action: 'ACCEPTED' | 'REJECTED') {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/public/proposals/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment || null }),
      })
      if (res.ok) {
        setResponseStatus(action)
        setResponseComment(comment || null)
      }
    } catch {
      // Silently fail — the user can retry
    } finally {
      setIsSubmitting(false)
    }
  }

  if (alreadyResponded || responseStatus === 'ACCEPTED' || responseStatus === 'REJECTED') {
    const isAccepted = responseStatus === 'ACCEPTED'
    return (
      <div className="mt-10 rounded-lg border p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {isAccepted ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
        </div>
        <h3 className="mt-3 text-lg font-semibold">
          Proposal {isAccepted ? 'Accepted' : 'Changes Requested'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAccepted
            ? 'Thank you! We will be in touch to schedule the kickoff.'
            : 'Your feedback has been received. We will follow up shortly.'}
        </p>
        {responseComment && (
          <div className="mt-4 rounded-md bg-muted p-3 text-left text-sm">
            <div className="mb-1 flex items-center gap-1 font-medium">
              <MessageSquare className="h-3.5 w-3.5" />
              Your comment
            </div>
            <p className="text-muted-foreground">{responseComment}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-10 space-y-4 rounded-lg border p-6">
      <h3 className="text-lg font-semibold">Ready to move forward?</h3>
      <Textarea
        placeholder="Add a comment (optional)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="flex-1" disabled={isSubmitting}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Accept Proposal
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept this proposal?</AlertDialogTitle>
              <AlertDialogDescription>
                By accepting, you agree to the terms outlined in this proposal.
                Our team will follow up to schedule the kickoff.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRespond('ACCEPTED')}>
                Confirm Acceptance
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="flex-1" disabled={isSubmitting}>
              <XCircle className="mr-2 h-4 w-4" />
              Request Changes
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Request changes?</AlertDialogTitle>
              <AlertDialogDescription>
                Your feedback will be shared with our team. We will follow up
                to discuss adjustments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRespond('REJECTED')}>
                Submit Feedback
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
