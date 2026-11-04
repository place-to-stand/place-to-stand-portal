import type { SheetEntityKey } from '@/lib/sheets/entities'

/**
 * `default` and `success` confirm something that just happened; `info` is
 * neutral news; `warning` is worth a look (a closed month affected);
 * `destructive` is a failure ("Unable to …").
 */
export type ToastVariant =
  'default' | 'success' | 'info' | 'warning' | 'destructive'

/**
 * The record a toast is about. The toast shows a link that opens its sheet
 * over the current page. Leave it out only when there is no record: a failed
 * create, a settings change, a month in the close.
 */
export type ToastLink = {
  entity: SheetEntityKey
  id: string
  /**
   * The record was just archived: the link goes to it on its list's
   * archive tab, the one place an archived record's sheet opens.
   */
  archived?: boolean
}

/** A toast's record link; none when the record has no id (yet). */
export const toastLink = (
  entity: SheetEntityKey,
  id: string | null | undefined,
  options?: { archived?: boolean }
): ToastLink | undefined =>
  id ? { entity, id, archived: options?.archived } : undefined

type Listener = (toast: ToastMessage) => void

const listeners = new Set<Listener>()

const DEFAULT_DURATION = 4000

export type ToastOptions = {
  id?: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  link?: ToastLink
}

export type ToastMessage = Required<Pick<ToastOptions, 'title'>> &
  Omit<ToastOptions, 'id'> & {
    id: string
  }

export function toast(options: ToastOptions): string {
  const id = options.id ?? generateId()
  const toastMessage: ToastMessage = {
    variant: 'default',
    duration: DEFAULT_DURATION,
    description: options.description,
    title: options.title,
    link: options.link,
    id,
  }

  if (options.variant) {
    toastMessage.variant = options.variant
  }

  if (typeof options.duration === 'number') {
    toastMessage.duration = options.duration
  }

  listeners.forEach(listener => listener(toastMessage))

  return id
}

export function subscribe(listener: Listener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return Math.random().toString(36).slice(2, 10)
}
