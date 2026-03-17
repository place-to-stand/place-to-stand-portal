export const dynamic = 'force-dynamic'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations, clientMembers } from '@pts/db/schema'
import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'

export default async function GitHubSetupPage() {
  const user = await requireClientUser()

  // Get client IDs the user has access to
  const memberships = isAdmin(user)
    ? []
    : await db
        .select({ clientId: clientMembers.clientId })
        .from(clientMembers)
        .where(
          and(
            eq(clientMembers.userId, user.id),
            isNull(clientMembers.deletedAt)
          )
        )

  const clientIds = memberships.map(m => m.clientId)

  // Get existing installations for those clients
  const installations =
    clientIds.length === 0
      ? []
      : await db
          .select()
          .from(githubAppInstallations)
          .where(
            and(
              eq(githubAppInstallations.status, 'ACTIVE'),
              isNull(githubAppInstallations.deletedAt)
            )
          )
          .then(rows =>
            rows.filter(row => clientIds.includes(row.clientId))
          )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">GitHub Integration</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Connect your GitHub repositories to enable automated workflows.
        </p>
      </div>

      {installations.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Connected Accounts
          </h2>
          {installations.map(inst => (
            <div
              key={inst.id}
              className="flex items-center gap-4 rounded-lg border border-foreground/10 p-4"
            >
              {inst.accountAvatarUrl && (
                <img
                  src={inst.accountAvatarUrl}
                  alt={inst.accountLogin}
                  className="h-10 w-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {inst.accountLogin}
                </p>
                <p className="text-sm text-foreground/60">
                  {inst.accountType} &middot;{' '}
                  {inst.repositorySelection === 'all'
                    ? 'All repositories'
                    : 'Selected repositories'}
                </p>
              </div>
              <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                Active
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-foreground/10 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {installations.length > 0
            ? 'Add Another Account'
            : 'Connect GitHub'}
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          Install the Place to Stand GitHub App on your organization or personal
          account to link repositories to your projects.
        </p>
        <a
          href="/api/github/install"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <svg
            className="h-5 w-5"
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
      </div>
    </div>
  )
}
