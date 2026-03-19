import { GitBranchIcon, ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RepoSelector } from './repo-selector'
import type { ProjectDetail } from '@/lib/data/project-detail'

export function GitHubSection({ project }: { project: ProjectDetail }) {
  const { github } = project

  if (github.state === 'no_installation') {
    return (
      <div className="rounded-lg border border-border p-5 space-y-3">
        <h2 className="font-semibold text-foreground">GitHub</h2>
        <p className="text-sm text-muted-foreground">
          Connect your GitHub account to link a repository to this project.
          This enables automated workflows and visibility into your codebase.
        </p>
        <Button asChild>
          <a href={`/api/github/install?projectId=${project.id}`}>
            <svg
              className="size-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            Install GitHub App
          </a>
        </Button>
      </div>
    )
  }

  if (github.state === 'installed') {
    return (
      <div className="rounded-lg border border-border p-5 space-y-3">
        <h2 className="font-semibold text-foreground">GitHub</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {github.installationAccountAvatarUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={github.installationAccountAvatarUrl}
              alt={github.installationAccountLogin}
              className="size-5 rounded-full"
            />
          )}
          <span>
            App installed on{' '}
            <span className="font-medium text-foreground">
              {github.installationAccountLogin}
            </span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a repository to link to this project.
        </p>
        {project.clientId && (
          <RepoSelector
            projectId={project.id}
            clientId={project.clientId}
          />
        )}
      </div>
    )
  }

  // github.state === 'linked'
  return (
    <div className="rounded-lg border border-border p-5 space-y-3">
      <h2 className="font-semibold text-foreground">GitHub</h2>
      <div className="flex items-center gap-2">
        <GitBranchIcon className="size-4 text-green-600" />
        <a
          href={`https://github.com/${github.repoFullName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          {github.repoFullName}
          <ExternalLinkIcon className="size-3 text-muted-foreground" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Default branch: {github.defaultBranch}
      </p>
    </div>
  )
}
