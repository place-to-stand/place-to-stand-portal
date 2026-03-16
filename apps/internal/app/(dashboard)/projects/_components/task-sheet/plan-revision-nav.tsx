'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type VersionDeployStatus = 'none' | 'dispatched' | 'pr_created'

export type VersionMeta = {
  /** Raw DB version number */
  version: number
  /** Display label: "Q", "Q1", "v1", "v2", etc. */
  label: string
  /** Whether this revision contains clarifying questions */
  isQuestions: boolean
  /** Deployment status for this version */
  deployStatus: VersionDeployStatus
}

type PlanRevisionNavProps = {
  currentVersion: number
  latestVersion: number
  /** Maps raw version → display info. If not provided, falls back to "v{n}" labels. */
  versionMeta?: VersionMeta[]
  modelLabel?: string
  onNavigate: (version: number) => void
  disabled?: boolean
}

export function PlanRevisionNav({
  currentVersion,
  latestVersion,
  versionMeta,
  modelLabel,
  onNavigate,
  disabled,
}: PlanRevisionNavProps) {
  if (latestVersion === 0) return null

  // Short model name: "Sonnet 4.6" → "Sonnet"
  const shortModel = modelLabel?.split(' ')[0]

  const hasPrev = currentVersion > 1
  const hasNext = currentVersion < latestVersion

  // Build display items for each version
  const items = Array.from({ length: latestVersion }, (_, i) => {
    const v = i + 1
    const meta = versionMeta?.find(m => m.version === v)
    return {
      version: v,
      label: meta?.label ?? `v${v}`,
      isQuestions: meta?.isQuestions ?? false,
      deployStatus: meta?.deployStatus ?? ('none' as VersionDeployStatus),
    }
  })

  return (
    <div className='flex items-center gap-1'>
      {shortModel && (
        <span className='mr-0.5 text-[10px] font-medium text-muted-foreground'>{shortModel}</span>
      )}

      <Button
        variant='ghost'
        size='icon'
        className='h-6 w-6'
        disabled={disabled || !hasPrev}
        onClick={() => onNavigate(currentVersion - 1)}
      >
        <ChevronLeft className='h-3.5 w-3.5' />
      </Button>

      <div className='flex items-center gap-0.5'>
        {items.map(item => {
          const isSelected = item.version === currentVersion
          return (
            <button
              key={item.version}
              onClick={() => onNavigate(item.version)}
              disabled={disabled}
              className={cn(
                'min-w-[20px] rounded px-1 py-0.5 text-[10px] font-medium transition-colors',
                getPillClasses(isSelected, item.isQuestions, item.deployStatus)
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <Button
        variant='ghost'
        size='icon'
        className='h-6 w-6'
        disabled={disabled || !hasNext}
        onClick={() => onNavigate(currentVersion + 1)}
      >
        <ChevronRight className='h-3.5 w-3.5' />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pill color logic
// Priority: questions (amber) > pr_created (green) > deployed (blue) > default
// ---------------------------------------------------------------------------

function getPillClasses(
  isSelected: boolean,
  isQuestions: boolean,
  deployStatus: VersionDeployStatus
): string {
  // Questions always use amber styling regardless of deploy status
  if (isQuestions) {
    return isSelected
      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
      : 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-500'
  }

  // PR created → green
  if (deployStatus === 'pr_created') {
    return isSelected
      ? 'bg-green-500/20 text-green-700 dark:text-green-400'
      : 'text-green-600 hover:bg-green-500/10 dark:text-green-500'
  }

  // Dispatched (no PR yet) → blue
  if (deployStatus === 'dispatched') {
    return isSelected
      ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
      : 'text-blue-600 hover:bg-blue-500/10 dark:text-blue-500'
  }

  // Default — no deployment
  return isSelected
    ? 'bg-primary text-primary-foreground'
    : 'text-muted-foreground hover:bg-muted'
}
