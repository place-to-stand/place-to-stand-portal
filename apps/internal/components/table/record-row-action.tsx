'use client'

import type { MouseEvent, ReactNode } from 'react'
import {
  Archive,
  Check,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UserPlus,
} from 'lucide-react'

import { RowActionButton } from '@pts/ui/row-action-button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

/**
 * The row actions every list and archive page shares. Each kind fixes its
 * icon, colour and wording ("Archive contact" is always red, "Restore …"
 * always outlined), so the lists can't drift apart. Most labels are
 * "<verb> <entity>"; the portal actions read the same on every list, so
 * their label ignores the entity.
 */
type KindConfig = {
  label: (entity: string) => string
  icon: ReactNode
  variant: 'outline' | 'destructive'
  className?: string
}

const KINDS = {
  edit: { label: e => `Edit ${e}`, icon: <Pencil />, variant: 'outline' },
  archive: {
    label: e => `Archive ${e}`,
    icon: <Archive />,
    variant: 'destructive',
  },
  restore: {
    label: e => `Restore ${e}`,
    icon: <RefreshCw />,
    variant: 'outline',
  },
  destroy: {
    label: e => `Permanently delete ${e}`,
    icon: <Trash2 />,
    variant: 'destructive',
  },
  delete: {
    label: e => `Delete ${e}`,
    icon: <Trash2 />,
    variant: 'destructive',
  },
  acknowledge: {
    label: e => `Acknowledge ${e}`,
    icon: <Check />,
    variant: 'outline',
  },
  preview: {
    label: () => 'Preview in client portal',
    icon: <Eye />,
    variant: 'outline',
  },
  /**
   * The one row action that creates something (a portal user) gets a pale
   * success tint so it scans apart from the neutral preview button and the
   * destructive archive button beside it.
   */
  promote: {
    label: () => 'Give portal sign-in',
    icon: <UserPlus />,
    variant: 'outline',
    className:
      'border-success/40 bg-success/10 text-success hover:border-success/60 hover:bg-success/20 hover:text-success',
  },
} satisfies Record<string, KindConfig>

export type RecordRowActionKind = keyof typeof KINDS

type RecordRowActionProps = {
  kind: RecordRowActionKind
  /**
   * Singular noun for the label: "contact" → "Archive contact". Unused by
   * `preview` and `promote`, whose wording is fixed.
   */
  entity?: string
  onClick: () => void
  disabled?: boolean
  /** Tooltip explaining why it's disabled. */
  disabledReason?: string | null
  /** This row's action is in flight: spinner in place of the icon. */
  pending?: boolean
}

export function RecordRowAction({
  kind,
  entity = '',
  onClick,
  disabled = false,
  disabledReason = null,
  pending = false,
}: RecordRowActionProps) {
  const config: KindConfig = KINDS[kind]
  return (
    <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
      <RowActionButton
        type='button'
        label={config.label(entity)}
        icon={pending ? <Loader2 className='animate-spin' /> : config.icon}
        variant={config.variant}
        className={config.className}
        disabled={disabled || pending}
        onClick={(event: MouseEvent) => {
          // Rows open their record on click; an action never should.
          event.stopPropagation()
          onClick()
        }}
      />
    </DisabledFieldTooltip>
  )
}

/** The right-aligned actions cell content, same spacing on every list. */
export function RecordRowActions({ children }: { children: ReactNode }) {
  return <div className='flex justify-end gap-2'>{children}</div>
}
