'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon, ExternalLinkIcon, InfoIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
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
      setTimeout(() => setCopiedEmail(current => (current === email ? null : current)), 1500)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Staff authorization</DialogTitle>
          <DialogDescription>
            Add our team as collaborators so they can review code directly.
          </DialogDescription>
        </DialogHeader>

        {staffAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No PTS staff have a connected GitHub account yet — nothing to add
            right now.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <p>Copy an email below and search for it on GitHub.</p>
            </div>
            {links.map(link => (
              <div key={link.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {link.repoFullName}
                  </span>
                  <Button variant="outline" size="xs" className="shrink-0 gap-1.5" asChild>
                    <a
                      href={`https://github.com/${link.repoFullName}/settings/access`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manage access
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  </Button>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {staffAccounts.map(staff => (
                    <li
                      key={staff.userId}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <GitHubMark className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="shrink-0 text-sm text-card-foreground">
                          {staff.name}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {staff.email}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCopy(staff.email)}
                          aria-label={`Copy ${staff.email}`}
                        >
                          {copiedEmail === staff.email ? (
                            <CheckIcon className="size-3.5" />
                          ) : (
                            <CopyIcon className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          className="shrink-0 gap-1"
                          asChild
                        >
                          <a
                            href={`https://github.com/${link.repoFullName}/settings/access`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Add on GitHub
                            <ExternalLinkIcon className="size-3" />
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
