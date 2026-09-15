'use client'

import { useState } from 'react'
import { ExternalLinkIcon } from 'lucide-react'

import { Button } from '@pts/ui/button'
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

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          GitHub
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={hasInstallation ? 'outline' : 'default'}
            size="xs"
            className="gap-1.5"
            disabled={hasInstallation}
            asChild={!hasInstallation}
          >
            {hasInstallation ? (
              <>
                <GitHubMark className="size-3.5" />
                Agent authorized
              </>
            ) : (
              <a
                href={`/api/github/install?clientId=${clientId}&projectId=${projectId}&returnTo=/projects/${projectId}`}
              >
                <GitHubMark className="size-3.5" />
                Authorize agent
              </a>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="gap-1.5"
            onClick={() => setStaffModalOpen(true)}
            disabled={links.length === 0}
            title={links.length === 0 ? 'Link a repository first' : undefined}
          >
            <GitHubMark className="size-3.5" />
            Staff authorization
          </Button>
        </div>
      </div>

      {notice && <p className="text-xs text-emerald-600">{notice}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {!hasInstallation ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-4">
          <GitHubMark className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Authorize our agent above to link repositories to this project.
          </p>
        </div>
      ) : links.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No repositories linked yet. Contact your account manager to link
            one.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card px-4">
          <ul className="divide-y divide-border">
            {links.map(link => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <a
                  href={`https://github.com/${link.repoFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-1.5 text-sm text-card-foreground hover:underline"
                >
                  <GitHubMark className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{link.repoFullName}</span>
                  <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {link.defaultBranch}
                </span>
              </li>
            ))}
          </ul>
        </div>
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
