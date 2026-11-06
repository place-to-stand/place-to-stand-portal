import type { ToastOptions } from '@/components/ui/use-toast'
import {
  countLabel,
  type BulkActionResult,
  type BulkArchiveEntity,
} from '@/lib/bulk/archive-entities'

/** Refused rows named in the toast before it says "and N more". */
const NAMED_FAILURES = 3

/** A bulk action's verb, as the toasts say it ("archive", "archived"). */
export type BulkVerb = { verb: string; past: string }

/**
 * The toasts for one bulk action: what changed, which rows were refused
 * and why, and any closed-month notes.
 */
export function describeBulkResult({
  result,
  entity,
  verb: { verb, past },
  nameOf,
}: {
  result: BulkActionResult
  entity: BulkArchiveEntity
  verb: BulkVerb
  nameOf?: (id: string) => string | undefined
}): ToastOptions[] {
  if (result.error) {
    return [
      {
        title: `Unable to ${verb}`,
        description: result.error,
        variant: 'destructive',
      },
    ]
  }

  const toasts: ToastOptions[] = []
  const total = result.done + result.failed.length
  const failures = result.failed
    .slice(0, NAMED_FAILURES)
    .map(({ id, error }) => {
      const name = nameOf?.(id)
      return name ? `${name}: ${error}` : error
    })
  const more = result.failed.length - failures.length
  const failureText = `${failures.join(' ')}${more > 0 ? ` And ${more} more.` : ''}`

  if (result.failed.length === 0) {
    toasts.push({ title: `${countLabel(entity, result.done)} ${past}` })
  } else if (result.done === 0) {
    toasts.push({
      title: `Unable to ${verb} ${countLabel(entity, total)}`,
      description: failureText,
      variant: 'destructive',
    })
  } else {
    toasts.push({
      title: `${countLabel(entity, result.done)} ${past}, ${result.failed.length} not`,
      description: failureText,
      variant: 'warning',
    })
  }

  for (const warning of result.warnings) {
    toasts.push({
      title: 'Closed month',
      description: warning,
      variant: 'warning',
    })
  }
  return toasts
}
