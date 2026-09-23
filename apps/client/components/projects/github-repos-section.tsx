'use client'

import { useState } from 'react'
import { ExternalLinkIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Card } from '@pts/ui/card'
import { EmptyState } from '@pts/ui/empty-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { GitHubMark } from '@/components/icons/github-mark'
import { useGitHubCallbackNotice } from '@/lib/hooks/use-github-callback-notice'
import { StaffAuthorizationModal } from '@/components/projects/staff-authorization-modal'
import type { ProjectGitHubLink } from '@/lib/data/github'
import type { PtsStaffGitHubAccount } from '@/lib/data/staff-github-access'

/**
 * GitHub connection state for a project. Everything it shows arrives as props
 * from the server (`fetchProjectGitHubStatus`), so there is no loading state:
 * the section renders complete with the rest of the page. After the install
 * callback GitHub redirects back to this page, which re-renders it fresh.
 */
export function GitHubRepoSection({
  projectId,
  clientId,
  hasInstallation,
  links,
  staffAccounts,
}: {
  projectId: string
  clientId: string
  hasInstallation: boolean
  links: ProjectGitHubLink[]
  staffAccounts: PtsStaffGitHubAccount[]
}) {
  const { notice, error } = useGitHubCallbackNotice(`/projects/${projectId}`)

  const [staffModalOpen, setStaffModalOpen] = useState(false)

  const staffButton = (
    <Button
      type='button'
      variant='outline'
      size='xs'
      onClick={() => setStaffModalOpen(true)}
      disabled={links.length === 0}
    >
      <GitHubMark />
      Staff authorization
    </Button>
  )

  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
          GitHub
        </h2>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant={hasInstallation ? 'outline' : 'default'}
            size='xs'
            disabled={hasInstallation}
            asChild={!hasInstallation}
          >
            {hasInstallation ? (
              <>
                <GitHubMark />
                Agent authorized
              </>
            ) : (
              <a
                href={`/api/github/install?clientId=${clientId}&projectId=${projectId}&returnTo=/projects/${projectId}`}
              >
                <GitHubMark />
                Authorize agent
              </a>
            )}
          </Button>
          {/* A disabled button takes no pointer events, so the reason hangs
              off a wrapper instead. */}
          {links.length === 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='inline-flex cursor-not-allowed'>
                  {staffButton}
                </span>
              </TooltipTrigger>
              <TooltipContent>Link a repository first</TooltipContent>
            </Tooltip>
          ) : (
            staffButton
          )}
        </div>
      </div>

      {notice && <p className='text-success text-xs'>{notice}</p>}
      {error && (
        <p className='text-destructive text-xs' role='alert'>
          {error}
        </p>
      )}

      {!hasInstallation ? (
        <EmptyState message='Authorize our agent above to link repositories to this project.' />
      ) : links.length === 0 ? (
        <EmptyState message='No repositories linked yet.' />
      ) : (
        <Card className='gap-0 overflow-hidden px-4 py-0'>
          <ul className='divide-border divide-y'>
            {links.map(link => (
              <li
                key={link.id}
                className='flex items-center justify-between gap-3 py-2.5'
              >
                <a
                  href={`https://github.com/${link.repoFullName}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-card-foreground flex min-w-0 items-center gap-1.5 text-sm hover:underline'
                >
                  <GitHubMark className='text-muted-foreground size-3.5 shrink-0' />
                  <span className='truncate-link'>{link.repoFullName}</span>
                  <ExternalLinkIcon className='text-muted-foreground size-3 shrink-0' />
                </a>
                <span className='text-muted-foreground shrink-0 text-xs'>
                  {link.defaultBranch}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <StaffAuthorizationModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        links={links}
        staffAccounts={staffAccounts}
      />
    </section>
  )
}
