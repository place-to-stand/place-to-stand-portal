'use client'

import type { MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

import { ENTITIES, type AccentEntity } from '@/lib/entity-accents'
import type { SheetEntityKey } from '@/lib/sheets/entities'
import {
  contactSheetHref,
  hourBlockHref,
  invoiceHref,
  leadHref,
  submissionHref,
} from '@/lib/sheets/hrefs'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

import type { ToastLink } from './toast'

/** Each sheet's entity in the registry (its name, icon and colour). */
const SHEET_ENTITY: Record<SheetEntityKey, AccentEntity> = {
  task: 'task',
  lead: 'lead',
  contact: 'contact',
  invoice: 'invoice',
  submission: 'submission',
  'hour-block': 'hourBlock',
  project: 'project',
  company: 'company',
}

/**
 * Where an archived record's sheet opens: its list's archive tab. Companies
 * open archived records anywhere; archived tasks and projects open nowhere,
 * so their archive toasts carry no link.
 */
const ARCHIVED_HREF: Partial<Record<SheetEntityKey, (id: string) => string>> = {
  contact: id => contactSheetHref(id, { archived: true }),
  invoice: id => invoiceHref(id, { archived: true }),
  'hour-block': id => hourBlockHref(id, { archived: true }),
  lead: id => leadHref(id, { archived: true }),
  submission: id => submissionHref(id, { archived: true }),
}

/** "Open task", in the entity's icon and name. */
export function toastLinkLabel(entity: SheetEntityKey) {
  const { icon, label } = ENTITIES[SHEET_ENTITY[entity]]
  return { icon, label: `Open ${label.toLowerCase()}` }
}

/**
 * The look of a toast's record link, shared by the live link and /design.
 */
export function ToastRecordLinkContent({ entity }: { entity: SheetEntityKey }) {
  const accent = ENTITIES[SHEET_ENTITY[entity]].accent
  const { icon: Icon, label } = toastLinkLabel(entity)
  return (
    <>
      <Icon aria-hidden className={cn('size-4 shrink-0', accent.icon)} />
      <span>{label}</span>
    </>
  )
}

export const toastRecordLinkClass =
  'text-foreground inline-flex w-fit cursor-pointer items-center gap-1.5 font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none'

/**
 * A toast's link to the record it's about: opens that record's sheet over
 * the current page, the way any sheet link does, and closes the toast. A
 * modified click (new tab, new window) follows the plain link instead.
 */
export function ToastRecordLink({
  link,
  onOpen,
}: {
  link: ToastLink
  onOpen: () => void
}) {
  const router = useRouter()
  const { get, hrefFor, open } = useSheetParams()
  const archivedHref = link.archived
    ? ARCHIVED_HREF[link.entity]?.(link.id)
    : undefined

  if (link.archived && !archivedHref) {
    return null
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    if (archivedHref) {
      router.push(archivedHref)
    } else if (get(link.entity) !== link.id) {
      open(link.entity, link.id)
    }
    onOpen()
  }

  return (
    <a
      href={archivedHref ?? hrefFor(link.entity, link.id)}
      onClick={handleClick}
      className={toastRecordLinkClass}
    >
      <ToastRecordLinkContent entity={link.entity} />
    </a>
  )
}
