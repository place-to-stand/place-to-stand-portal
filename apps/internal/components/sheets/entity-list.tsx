'use client'

import type { ReactElement, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'

import { InlineReveal } from '@/components/ui/inline-reveal'

import { SectionAddButton } from './section-add-button'
import { SheetRecordList } from './sheet-record-row'
import { SheetSection } from './sheet-section'

export type EntityListAdd = {
  /** The +'s accessible name: "Add person", "Log time". */
  label: string
  /**
   * Runs from the + and from the empty state alike (opens the picker, the
   * sheet, the dialog). Leave it out when `render` wraps the + in a picker
   * trigger and the picker's own open state is set by `onAdd` elsewhere.
   */
  onAdd?: () => void
  disabled?: boolean
  /** Disables the + (and the empty state) and explains why on hover. */
  disabledReason?: string | null
  /** Wraps the + so it can be a popover or combobox trigger. */
  render?: (button: ReactElement) => ReactNode
}

type EntityListProps = {
  title: string
  /** An entity's registry icon shows in its colour; others stay muted. */
  icon?: LucideIcon
  description?: string
  /** Inline after the title (a count badge). */
  titleAddon?: ReactNode
  /** The + in the heading. Leave it out for a read-only list. */
  add?: EntityListAdd
  /** One plain sentence. Clicking it runs `add.onAdd` when adding is allowed. */
  emptyMessage: string
  isEmpty: boolean
  /** Replaces the body while loading or after a failed load. */
  status?: ReactNode
  /** The rows: `SheetRecordRow`s, or any preview card. */
  children?: ReactNode
  /**
   * An add form that opens in place (logging a lead update): it sits under
   * the heading, above the list, and eases its own height open and closed.
   */
  inlineForm?: ReactNode
  /** While true, the empty state fades out so only the form shows. */
  inlineFormOpen?: boolean
  /** Under the list or empty state (a pending-change note). */
  footer?: ReactNode
  className?: string
}

/**
 * A sheet's list of related records: heading (+ on the right), then one
 * preview card per record 8px below, or a dashed empty state that does
 * what the + does. Every "people at this company", "linked tasks", "time
 * logs" list uses it, so they look and behave the same.
 */
export function EntityList({
  title,
  icon,
  description,
  titleAddon,
  add,
  emptyMessage,
  isEmpty,
  status,
  children,
  inlineForm,
  inlineFormOpen = false,
  footer,
  className,
}: EntityListProps) {
  const canAdd = Boolean(add && !add.disabled && !add.disabledReason)

  let action: ReactNode = null
  if (add) {
    const button = (
      <SectionAddButton
        label={add.label}
        disabled={add.disabled}
        disabledReason={add.disabledReason}
        onClick={add.render ? undefined : add.onAdd}
      />
    )
    action = canAdd && add.render ? add.render(button) : button
  }

  return (
    <SheetSection
      list
      title={title}
      icon={icon}
      description={description}
      titleAddon={titleAddon}
      action={action}
      className={className}
    >
      {/* One child, so a closed form adds no gap of its own. */}
      <div>
        {inlineForm}
        {status ??
          (isEmpty ? (
            <InlineReveal open={!inlineFormOpen}>
              <EmptyState
                message={emptyMessage}
                label={canAdd ? add?.label : undefined}
                onClick={canAdd ? add?.onAdd : undefined}
              />
            </InlineReveal>
          ) : (
            <SheetRecordList>{children}</SheetRecordList>
          ))}
      </div>
      {footer}
    </SheetSection>
  )
}
