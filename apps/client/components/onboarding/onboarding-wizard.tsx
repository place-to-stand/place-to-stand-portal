'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { completeOnboarding } from '@/app/onboarding/_actions/complete-onboarding'
import { OnboardingProjectCard } from './onboarding-project-card'
import type { ClientProject } from '@/lib/data/projects'

type OnboardingUser = {
  id: string
  email: string
  fullName: string | null
}

type OnboardingWizardProps = {
  user: OnboardingUser
  projects: ClientProject[]
  mustResetPassword: boolean
}

export function OnboardingWizard({
  user,
  projects,
  mustResetPassword,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const searchParams = useSearchParams()
  const githubJustInstalled = searchParams.get('github') === 'installed'

  const firstName = user.fullName?.split(' ')[0] ?? user.email.split('@')[0]

  // Step mapping: welcome → password (conditional) → projects → done
  const STEP_WELCOME = 0
  const STEP_PASSWORD = 1
  const STEP_PROJECTS = 2
  const STEP_DONE = 3

  function advanceFromWelcome() {
    setStep(mustResetPassword ? STEP_PASSWORD : STEP_PROJECTS)
  }

  if (step === STEP_WELCOME) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {firstName}!
          </h1>
          <p className="text-sm text-muted-foreground">
            We&apos;re excited to have you on board. Let&apos;s get your workspace set up
            — it only takes a minute.
          </p>
        </div>
        <Button onClick={advanceFromWelcome} className="w-full sm:w-auto">
          Get Started
        </Button>
      </div>
    )
  }

  if (step === STEP_PASSWORD) {
    return (
      <SetPasswordStep onComplete={() => setStep(STEP_PROJECTS)} />
    )
  }

  if (step === STEP_PROJECTS) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here are the projects you have access to. You can optionally connect
            GitHub to enable automated workflows.
          </p>
        </div>

        {githubJustInstalled && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            GitHub App installed successfully! Select a repository below to link
            it.
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No projects yet. Your account manager will set these up for you.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map(project => (
              <OnboardingProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(STEP_DONE)}
          >
            Skip for now
          </Button>
          <Button onClick={() => setStep(STEP_DONE)}>Continue</Button>
        </div>
      </div>
    )
  }

  // Step 3 — Done
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">You&apos;re all set!</h1>
        <p className="text-sm text-muted-foreground">
          Your workspace is ready. You can manage your projects and GitHub
          integrations from the dashboard.
        </p>
      </div>
      <form action={completeOnboarding}>
        <Button type="submit" className="w-full sm:w-auto">
          Go to Dashboard
        </Button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Set Password Step                                                 */
/* ------------------------------------------------------------------ */

function SetPasswordStep({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { must_reset_password: false },
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      onComplete()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Set your password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a secure password you&apos;ll use to sign in going forward.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-foreground"
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-foreground"
          >
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Updating...' : 'Set password & continue'}
        </Button>
      </form>
    </div>
  )
}
