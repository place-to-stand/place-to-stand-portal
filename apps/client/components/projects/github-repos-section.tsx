'use client'

import { useState } from 'react'
import { ExternalLinkIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Card } from '@pts/ui/card'
import { EmptyState } from '@pts/ui/empty-state'
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
 *
 * A linked repo settles it: once one exists the client has nothing to connect,
 * whether it lives in the agency's org or theirs. The authorize button only
 * appears while the project has no repo and the client has no App install.
 * Staff authorization only applies to repos the client owns, i.e. those linked
 * through their own install.
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

  const needsConnection = links.length === 0 && !hasInstallation
  const clientOwnedLinks = links.filter(link => link.viaClientInstallation)

  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
          GitHub
        </h2>
        <div className='flex flex-wrap items-center gap-2'>
          {needsConnection && (
            <Button type='button' size='xs' asChild>
              <a
                href={`/api/github/install?clientId=${clientId}&projectId=${projectId}&returnTo=/projects/${projectId}`}
              >
                <GitHubMark />
                Authorize agent
              </a>
            </Button>
          )}
          {clientOwnedLinks.length > 0 && (
            <Button
              type='button'
              variant='outline'
              size='xs'
              onClick={() => setStaffModalOpen(true)}
            >
              <GitHubMark />
              Staff authorization
            </Button>
          )}
        </div>
      </div>

      {notice && <p className='text-success text-xs'>{notice}</p>}
      {error && (
        <p className='text-destructive text-xs' role='alert'>
          {error}
        </p>
      )}

      {needsConnection ? (
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
        links={clientOwnedLinks}
        staffAccounts={staffAccounts}
      />
    </section>
  )
}
