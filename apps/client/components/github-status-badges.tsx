'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2Icon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { GitHubMark } from '@/components/icons/github-mark'
import { useGitHubCallbackNotice } from '@/lib/hooks/use-github-callback-notice'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { StaffAuthorizationModal } from '@/components/projects/staff-authorization-modal'
import type { ClientGitHubStatus } from '@/lib/data/github'
import type { PtsStaffGitHubAccount } from '@/lib/data/staff-github-access'

type ConnectedStatus = Extract<ClientGitHubStatus, { kind: 'connected' }>

/** "acme/site", "3 repos linked", or "Connected" when nothing's linked yet. */
function connectedLabel(
  status: ConnectedStatus,
  showClientName: boolean
): string {
  const prefix = showClientName ? `${status.clientName} · ` : ''
  const { linkedRepos } = status

  if (linkedRepos.length === 0) return `${prefix}Connected`
  if (linkedRepos.length === 1) return `${prefix}${linkedRepos[0].repoFullName}`
  return `${prefix}${linkedRepos.length} repos linked`
}

/**
 * Compact GitHub connection status, one small control per client passed in.
 * The dashboard renders it in each client section's header.
 */
export function GitHubStatusBadges({
  statuses,
  showClientName,
  staffAccounts,
  showCallbackNotice = true,
}: {
  statuses: ClientGitHubStatus[]
  showClientName: boolean
  staffAccounts: PtsStaffGitHubAccount[]
  /** The post-install notice; show it on one instance when there are several. */
  showCallbackNotice?: boolean
}) {
  const { notice, error } = useGitHubCallbackNotice('/')

  if (statuses.length === 0) return null

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {statuses.map(status => (
        <GitHubStatusBadge
          key={status.clientId}
          status={status}
          showClientName={showClientName}
          staffAccounts={staffAccounts}
        />
      ))}
      {showCallbackNotice && notice && (
        <span className='text-success text-xs'>{notice}</span>
      )}
      {showCallbackNotice && error && (
        <span className='text-destructive text-xs' role='alert'>
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
      <Button variant='outline' size='xs' className='shrink-0' asChild>
        <a href={`/api/github/install?clientId=${status.clientId}&returnTo=/`}>
          <GitHubMark />
          {showClientName ? `Connect ${status.clientName}` : 'Connect GitHub'}
        </a>
      </Button>
    )
  }

  const staffButton = (
    <Button
      type='button'
      variant='outline'
      size='xs'
      className='shrink-0'
      onClick={() => setStaffModalOpen(true)}
      disabled={status.linkedRepos.length === 0}
    >
      <GitHubMark />
      {showClientName
        ? `Staff authorization · ${status.clientName}`
        : 'Staff authorization'}
    </Button>
  )

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' size='xs' className='shrink-0'>
            <GitHubMark />
            <span className='max-w-56 truncate'>
              {connectedLabel(status, showClientName)}
            </span>
            <CheckCircle2Icon className='text-success' />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-64 space-y-2 text-sm'>
          {status.linkedRepos.length === 0 ? (
            <p className='text-muted-foreground'>
              Connected as{' '}
              <span className='text-foreground font-medium'>
                {status.accountLogin}
              </span>
              . No repositories linked yet.
            </p>
          ) : (
            <ul className='space-y-2'>
              {status.linkedRepos.map(repo => (
                <li key={repo.id} className='text-muted-foreground'>
                  Place To Stand GitHub App installed on{' '}
                  <Link
                    href={`/projects/${repo.projectId}`}
                    className='text-foreground font-medium hover:underline'
                  >
                    {repo.repoFullName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      {/* A disabled button takes no pointer events, so the reason hangs off a
          wrapper instead. */}
      {status.linkedRepos.length === 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='inline-flex shrink-0 cursor-not-allowed'>
              {staffButton}
            </span>
          </TooltipTrigger>
          <TooltipContent>Link a repository first</TooltipContent>
        </Tooltip>
      ) : (
        staffButton
      )}
      <StaffAuthorizationModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        links={status.linkedRepos}
        staffAccounts={staffAccounts}
      />
    </>
  )
}
