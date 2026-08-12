'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

import type { SheetEntityKey } from './entities'
import type { SheetWrapperProps } from './wrappers/types'

/**
 * Entity → lazy self-sufficient sheet wrapper, rendered by the SheetHost for
 * params the current page doesn't claim. Wrappers (and their sheet bundles)
 * load only when a foreign param is actually present.
 *
 * Adding a new deep-linkable entity is: a param in entities.ts, a payload +
 * resolver in init/, a wrapper, and one line here.
 */
const WRAPPERS: Record<SheetEntityKey, ComponentType<SheetWrapperProps>> = {
  task: dynamic(
    () =>
      import('./wrappers/task-sheet-wrapper').then(
        module => module.TaskSheetWrapper
      ),
    { ssr: false }
  ),
  lead: dynamic(
    () =>
      import('./wrappers/lead-sheet-wrapper').then(
        module => module.LeadSheetWrapper
      ),
    { ssr: false }
  ),
  client: dynamic(
    () =>
      import('./wrappers/client-sheet-wrapper').then(
        module => module.ClientSheetWrapper
      ),
    { ssr: false }
  ),
  contact: dynamic(
    () =>
      import('./wrappers/contact-sheet-wrapper').then(
        module => module.ContactSheetWrapper
      ),
    { ssr: false }
  ),
  invoice: dynamic(
    () =>
      import('./wrappers/invoice-sheet-wrapper').then(
        module => module.InvoiceSheetWrapper
      ),
    { ssr: false }
  ),
  submission: dynamic(
    () =>
      import('./wrappers/submission-sheet-wrapper').then(
        module => module.SubmissionSheetWrapper
      ),
    { ssr: false }
  ),
  'hour-block': dynamic(
    () =>
      import('./wrappers/hour-block-sheet-wrapper').then(
        module => module.HourBlockSheetWrapper
      ),
    { ssr: false }
  ),
  user: dynamic(
    () =>
      import('./wrappers/user-sheet-wrapper').then(
        module => module.UserSheetWrapper
      ),
    { ssr: false }
  ),
  project: dynamic(
    () =>
      import('./wrappers/project-sheet-wrapper').then(
        module => module.ProjectSheetWrapper
      ),
    { ssr: false }
  ),
}

export const getSheetWrapper = (
  entity: SheetEntityKey
): ComponentType<SheetWrapperProps> | null => WRAPPERS[entity] ?? null
