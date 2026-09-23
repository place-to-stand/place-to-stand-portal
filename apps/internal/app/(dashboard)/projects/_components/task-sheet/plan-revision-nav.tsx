'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@pts/ui/button'
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
        <span className='text-muted-foreground mr-0.5 text-[10px] font-medium'>
          {shortModel}
        </span>
      )}

      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Previous version'
        disabled={disabled || !hasPrev}
        onClick={() => onNavigate(currentVersion - 1)}
      >
        <ChevronLeft />
      </Button>

      <div className='flex items-center gap-0.5'>
        {items.map(item => {
          const isSelected = item.version === currentVersion
          return (
            <Button
              key={item.version}
              type='button'
              size='xs'
              variant={getPillVariant(
                isSelected,
                item.isQuestions,
                item.deployStatus
              )}
              aria-pressed={isSelected}
              onClick={() => onNavigate(item.version)}
              disabled={disabled}
              className={cn(
                'min-w-7 px-1.5',
                getPillClasses(isSelected, item.isQuestions, item.deployStatus)
              )}
            >
              {item.label}
            </Button>
          )
        })}
      </div>

      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Next version'
        disabled={disabled || !hasNext}
        onClick={() => onNavigate(currentVersion + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pill color logic
// Priority: questions (warning) > pr_created (success) > dispatched (warning,
// pending) > default. Status colors come from the three status tokens only.
// ---------------------------------------------------------------------------

type PillTone = 'warning' | 'success' | null

function getPillTone(
  isQuestions: boolean,
  deployStatus: VersionDeployStatus
): PillTone {
  if (isQuestions) return 'warning'
  if (deployStatus === 'pr_created') return 'success'
  if (deployStatus === 'dispatched') return 'warning'
  return null
}

function getPillVariant(
  isSelected: boolean,
  isQuestions: boolean,
  deployStatus: VersionDeployStatus
): 'default' | 'ghost' {
  // An untinted selected pill is the solid primary chip
  return isSelected && !getPillTone(isQuestions, deployStatus)
    ? 'default'
    : 'ghost'
}

function getPillClasses(
  isSelected: boolean,
  isQuestions: boolean,
  deployStatus: VersionDeployStatus
): string {
  const tone = getPillTone(isQuestions, deployStatus)

  if (tone === 'warning') {
    return isSelected
      ? 'bg-warning/20 text-warning hover:bg-warning/20 hover:text-warning'
      : 'text-warning hover:bg-warning/10 hover:text-warning'
  }

  if (tone === 'success') {
    return isSelected
      ? 'bg-success/20 text-success hover:bg-success/20 hover:text-success'
      : 'text-success hover:bg-success/10 hover:text-success'
  }

  return isSelected ? '' : 'text-muted-foreground'
}
