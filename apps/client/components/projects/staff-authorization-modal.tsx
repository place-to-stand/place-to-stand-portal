'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'

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
  staffAccounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: RepoLink[]
  staffAccounts: PtsStaffGitHubAccount[]
}) {
  const [copiedLogin, setCopiedLogin] = useState<string | null>(null)

  const handleCopy = (login: string) => {
    void navigator.clipboard.writeText(login).then(() => {
      setCopiedLogin(login)
      setTimeout(() => setCopiedLogin(current => (current === login ? null : current)), 1500)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Staff authorization</DialogTitle>
          <DialogDescription>
            Add our team as collaborators on GitHub so they can review code
            and pull requests directly. This is separate from the GitHub App
            connection above, which only covers automated access.
          </DialogDescription>
        </DialogHeader>

        {staffAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No PTS staff have a connected GitHub account yet — nothing to add
            right now.
          </p>
        ) : (
          <div className="space-y-4">
            {links.map(link => (
              <div key={link.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
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
                        <span className="truncate text-sm text-card-foreground">
                          {staff.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          @{staff.githubLogin}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCopy(staff.githubLogin)}
                          aria-label={`Copy ${staff.githubLogin}`}
                        >
                          {copiedLogin === staff.githubLogin ? (
                            <CheckIcon className="size-3.5" />
                          ) : (
                            <CopyIcon className="size-3.5" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a
                            href={`https://github.com/${link.repoFullName}/settings/access`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Add ${staff.githubLogin} on GitHub`}
                          >
                            <ExternalLinkIcon className="size-3.5" />
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
