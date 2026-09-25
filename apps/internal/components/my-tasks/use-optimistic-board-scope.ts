'use client'

import { useMemo, useOptimistic } from 'react'

import type { ProjectTypeValue } from '@/lib/types'

import type { TaskLookup } from './my-tasks-board'

/** The client selector's scope: `?clientId=` plus `?hide=`. */
export type MyTasksBoardScope = {
  /** A client id, or `'all'` when unscoped. */
  clientId: string
  /** Project types withheld from the board; empty = show all. */
  hiddenProjectTypes: ProjectTypeValue[]
}

export type MyTasksBoardScopePatch = Partial<MyTasksBoardScope>

function applyScopePatch(
  current: MyTasksBoardScope,
  patch: MyTasksBoardScopePatch
): MyTasksBoardScope {
  return { ...current, ...patch }
}

/**
 * The client selector writes the URL, and the server props only catch up
 * when that navigation lands. This returns the scope to render in the
 * meantime. Call `applyScope` inside the navigation transition so the
 * optimistic value holds until the new render arrives.
 *
 * Patches rather than whole values: picking a client while a checkbox toggle
 * is still in flight keeps both changes.
 */
export function useOptimisticBoardScope(
  clientId: string,
  hiddenProjectTypes: ProjectTypeValue[]
) {
  // Stable between server renders, so "pending" is a reference check: the
  // props only get new identities when a navigation or refresh lands.
  const serverScope = useMemo<MyTasksBoardScope>(
    () => ({ clientId, hiddenProjectTypes }),
    [clientId, hiddenProjectTypes]
  )
  const [scope, applyScope] = useOptimistic(serverScope, applyScopePatch)

  return { scope, applyScope, isPending: scope !== serverScope }
}

/**
 * Narrow already-loaded entries to a scope. This can only take tasks away:
 * a wider scope needs the server, because those tasks were never loaded.
 * Mirrors the server's rule that the type scope only applies under all
 * clients (PERSONAL and INTERNAL projects have no client anyway).
 */
export function filterEntriesToScope<T extends { taskId: string }>(
  entries: T[],
  taskLookup: TaskLookup,
  scope: MyTasksBoardScope
): T[] {
  const isAllClients = scope.clientId === 'all'

  if (isAllClients && !scope.hiddenProjectTypes.length) {
    return entries
  }

  return entries.filter(entry => {
    const project = taskLookup.get(entry.taskId)?.project

    if (!project) {
      return true
    }

    if (!isAllClients) {
      return project.client_id === scope.clientId
    }

    return !scope.hiddenProjectTypes.includes(project.type)
  })
}
