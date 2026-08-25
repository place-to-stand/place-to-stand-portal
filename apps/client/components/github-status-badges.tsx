'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GitHubMark } from '@/components/icons/github-mark'
import { useGitHubCallbackNotice } from '@/lib/hooks/use-github-callback-notice'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { StaffAuthorizationModal } from '@/components/projects/staff-authorization-modal'
import type { ClientGitHubStatus } from '@/lib/data/github'
import type { PtsStaffGitHubAccount } from '@/lib/data/staff-github-access'

type ConnectedStatus = Extract<ClientGitHubStatus, { kind: 'connected' }>

/** "acme/site", "3 repos linked", or "Connected" when nothing's linked yet. */
function connectedLabel(status: ConnectedStatus, showClientName: boolean): string {
  const prefix = showClientName ? `${status.clientName} · ` : ''
  const { linkedRepos } = status

  if (linkedRepos.length === 0) return `${prefix}Connected`
  if (linkedRepos.length === 1) return `${prefix}${linkedRepos[0].repoFullName}`
  return `${prefix}${linkedRepos.length} repos linked`
}

/**
 * Compact GitHub connection status, meant to sit on the dashboard title row
 * rather than take up a full card — one small control per client in scope.
 */
export function GitHubStatusBadges({
  statuses,
  showClientName,
  staffAccounts,
}: {
  statuses: ClientGitHubStatus[]
  showClientName: boolean
  staffAccounts: PtsStaffGitHubAccount[]
}) {
  const { notice, error } = useGitHubCallbackNotice('/')

  if (statuses.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {statuses.map(status => (
        <GitHubStatusBadge
          key={status.clientId}
          status={status}
          showClientName={showClientName}
          staffAccounts={staffAccounts}
        />
      ))}
      {notice && <span className="text-xs text-emerald-600">{notice}</span>}
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

function GitHubStatusBadge({
  status,
  showClientName,
  staffAccounts,
}: {
  status: ClientGitHubStatus
  showClientName: boolean
  staffAccounts: PtsStaffGitHubAccount[]
}) {
  const [staffModalOpen, setStaffModalOpen] = useState(false)

  if (status.kind === 'not_connected') {
    return (
      <Button variant="outline" size="xs" className="shrink-0" asChild>
        <a href={`/api/github/install?clientId=${status.clientId}&returnTo=/`}>
          <GitHubMark className="size-3" />
          {showClientName ? `Connect ${status.clientName}` : 'Connect GitHub'}
        </a>
      </Button>
    )
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="xs" className="shrink-0">
            <GitHubMark className="size-3" />
            <span className="max-w-[220px] truncate">
              {connectedLabel(status, showClientName)}
            </span>
            <CheckCircle2Icon className="size-3 text-emerald-600 dark:text-emerald-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-2 text-sm">
          {status.linkedRepos.length === 0 ? (
            <p className="text-muted-foreground">
              Connected as{' '}
              <span className="font-medium text-foreground">{status.accountLogin}</span>
              . No repositories linked yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {status.linkedRepos.map(repo => (
                <li key={repo.id} className="text-muted-foreground">
                  Place To Stand GitHub App installed on{' '}
                  <Link
                    href={`/projects/${repo.projectId}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {repo.repoFullName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="shrink-0 gap-1.5"
        onClick={() => setStaffModalOpen(true)}
        disabled={status.linkedRepos.length === 0}
        title={
          status.linkedRepos.length === 0
            ? 'Link a repository first'
            : undefined
        }
      >
        <GitHubMark className="size-3" />
        {showClientName ? `Staff authorization · ${status.clientName}` : 'Staff authorization'}
      </Button>
      <StaffAuthorizationModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        links={status.linkedRepos}
        staffAccounts={staffAccounts}
      />
    </>
  )
}
