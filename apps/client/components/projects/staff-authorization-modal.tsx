'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon, ExternalLinkIcon, InfoIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { RowActionButton } from '@pts/ui/row-action-button'
import { GitHubMark } from '@/components/icons/github-mark'
import type { PtsStaffGitHubAccount } from '@/lib/data/staff-github-access'

interface RepoLink {
  id: string
  repoFullName: string
}

export function StaffAuthorizationModal({
  open,
  onOpenChange,
  links,
  staffAccounts = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: RepoLink[]
  staffAccounts?: PtsStaffGitHubAccount[]
}) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const handleCopy = (email: string) => {
    void navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(email)
      setTimeout(
        () => setCopiedEmail(current => (current === email ? null : current)),
        1500
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Staff authorization</DialogTitle>
          <DialogDescription>
            Add our team as collaborators so they can review code directly.
          </DialogDescription>
        </DialogHeader>

        {staffAccounts.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No PTS staff have a connected GitHub account yet — nothing to add
            right now.
          </p>
        ) : (
          <div className='space-y-4'>
            <div className='border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-xs'>
              <InfoIcon className='mt-0.5 size-3.5 shrink-0' />
              <p>Copy an email below and search for it on GitHub.</p>
            </div>
            {links.map(link => (
              <div key={link.id} className='space-y-2'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-foreground min-w-0 flex-1 truncate text-sm font-medium'>
                    {link.repoFullName}
                  </span>
                  <Button
                    variant='outline'
                    size='xs'
                    className='shrink-0'
                    asChild
                  >
                    <a
                      href={`https://github.com/${link.repoFullName}/settings/access`}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      Manage access
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                </div>
                <ul className='divide-border border-border divide-y overflow-hidden rounded-lg border'>
                  {staffAccounts.map(staff => (
                    <li
                      key={staff.userId}
                      className='flex items-center justify-between gap-3 px-3 py-2'
                    >
                      <div className='flex min-w-0 items-center gap-2'>
                        <GitHubMark className='text-muted-foreground size-3.5 shrink-0' />
                        <span className='text-card-foreground shrink-0 text-sm'>
                          {staff.name}
                        </span>
                        <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
                          {staff.email}
                        </span>
                      </div>
                      <div className='flex shrink-0 items-center gap-1.5'>
                        <RowActionButton
                          type='button'
                          label={`Copy ${staff.email}`}
                          icon={
                            copiedEmail === staff.email ? (
                              <CheckIcon />
                            ) : (
                              <CopyIcon />
                            )
                          }
                          onClick={() => handleCopy(staff.email)}
                        />
                        <Button
                          variant='outline'
                          size='xs'
                          className='shrink-0'
                          asChild
                        >
                          <a
                            href={`https://github.com/${link.repoFullName}/settings/access`}
                            target='_blank'
                            rel='noopener noreferrer'
                          >
                            Add on GitHub
                            <ExternalLinkIcon />
                          </a>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
