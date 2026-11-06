import { softDeleteHourBlock } from '@/app/(dashboard)/hour-blocks/actions'
import { toastLink, type useToast } from '@/components/ui/use-toast'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import type { HourBlockWithClient } from './hour-block-form'

type Toast = ReturnType<typeof useToast>['toast']

/**
 * Archives an hour block from its sheet and reports the result as toasts.
 * Resolves true when it was archived.
 */
export async function archiveHourBlockFromSheet(
  hourBlock: HourBlockWithClient,
  toast: Toast
): Promise<boolean> {
  const interaction = startSettingsInteraction({
    entity: 'hour_block',
    mode: 'delete',
    targetId: hourBlock.id,
    metadata: {
      companyId: hourBlock.client?.id ?? null,
    },
  })

  try {
    const result = await softDeleteHourBlock({ id: hourBlock.id })

    if (result.error) {
      finishSettingsInteraction(interaction, {
        status: 'error',
        targetId: hourBlock.id,
        error: result.error,
      })
      toast({
        title: 'Unable to archive hour block',
        description: result.error,
        variant: 'destructive',
        link: toastLink('hour-block', hourBlock.id),
      })
      return false
    }

    finishSettingsInteraction(interaction, {
      status: 'success',
      targetId: hourBlock.id,
    })

    toast({
      title: 'Hour block archived',
      description:
        'It will be hidden from active tracking but remains available historically.',
      link: toastLink('hour-block', hourBlock.id, { archived: true }),
    })
    if (result.warning) {
      toast({
        title: 'Closed month affected',
        description: result.warning,
        variant: 'warning',
        link: toastLink('hour-block', hourBlock.id, { archived: true }),
      })
    }
    return true
  } catch (error) {
    finishSettingsInteraction(interaction, {
      status: 'error',
      targetId: hourBlock.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    toast({
      title: 'Unable to archive hour block',
      description: error instanceof Error ? error.message : 'Unknown error.',
      variant: 'destructive',
      link: toastLink('hour-block', hourBlock.id),
    })
    return false
  }
}
