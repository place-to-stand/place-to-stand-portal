'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { startTransition, useCallback, useMemo } from 'react'

import { CommandGroup, CommandSeparator } from '@/components/ui/command'
import { FILTER_TRIGGER_WIDTH } from '@/components/ui/field-trigger'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import type { ProjectTypeValue } from '@/lib/types'
import {
  HIDE_PARAM,
  HIDEABLE_PROJECT_TYPES,
  describeHiddenProjectTypes,
  serializeHiddenProjectTypes,
  type HideableProjectType,
} from '@/lib/my-tasks/project-scope'

import { ClientScopeRow } from './client-scope-row'
import type { MyTasksBoardScopePatch } from './use-optimistic-board-scope'

const ALL_CLIENTS_VALUE = 'all'
const ALL_CLIENTS_LABEL = 'All clients'

const SCOPE_ROWS: { type: HideableProjectType; label: string }[] = [
  { type: HIDEABLE_PROJECT_TYPES.personal, label: 'Personal projects' },
  { type: HIDEABLE_PROJECT_TYPES.internal, label: 'Internal projects' },
]

export type ClientSelectorOption = {
  id: string
  name: string
}

type ClientSelectorProps = {
  clients: ClientSelectorOption[]
  /**
   * A client id, or `'all'` (the default — no client filter). Pass the
   * parent's optimistic scope so the trigger updates on click.
   */
  selectedClientId: string
  /**
   * Project types withheld from the board; empty = show everything. Also
   * optimistic, so rapid toggles build on each other.
   */
  hiddenProjectTypes: ProjectTypeValue[]
  /**
   * Called inside the navigation transition, so a parent `useOptimistic`
   * scope holds from the click until the server render lands.
   */
  onScopeChange: (patch: MyTasksBoardScopePatch) => void
  disabled?: boolean
}

/**
 * Client + project-type scope for the My Tasks board — the person selector's
 * sibling, for walking one client at a time in weekly planning.
 *
 * State lives in two params next to `?assignee=`: `?companyId=` (NOT
 * `?client=`, which is an old deep-link param (it opens the company sheet) and would open the
 * edit sheet on every dashboard route) and `?hide=personal,internal`. The
 * "Show" checkboxes only matter under "All clients": PERSONAL and INTERNAL
 * projects have no client, so a client selection already excludes them.
 */
export function ClientSelector({
  clients,
  selectedClientId,
  hiddenProjectTypes,
  onScopeChange,
  disabled = false,
}: ClientSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  )

  const isAllClients = selectedClientId === ALL_CLIENTS_VALUE
  // The hint reflects what the board is actually withholding. Under a single
  // client the type scope is implied, so it stays quiet there.
  const hiddenHint = isAllClients
    ? describeHiddenProjectTypes(hiddenProjectTypes)
    : ''

  // Without the transition the trigger and checkboxes waited out the whole
  // server render before changing. The optimistic patch and the push share
  // one transition, so the patch holds until the new scope's data arrives.
  const changeScope = useCallback(
    (
      patch: MyTasksBoardScopePatch,
      mutate: (params: URLSearchParams) => void
    ) => {
      startTransition(() => {
        onScopeChange(patch)
        // Unrelated params (sheet stack, assignee) ride along untouched.
        const params = new URLSearchParams(searchParams.toString())
        mutate(params)
        const search = params.toString()
        router.push(search ? `${pathname}?${search}` : pathname, {
          scroll: false,
        })
      })
    },
    [onScopeChange, pathname, router, searchParams]
  )

  const handleSelectClient = useCallback(
    (companyId: string) => {
      changeScope({ companyId }, params => {
        if (companyId !== ALL_CLIENTS_VALUE) {
          params.set('companyId', companyId)
        } else {
          params.delete('companyId')
        }
      })
    },
    [changeScope]
  )

  const handleToggleType = useCallback(
    (type: HideableProjectType) => {
      const next = hiddenProjectTypes.includes(type)
        ? hiddenProjectTypes.filter(hidden => hidden !== type)
        : [...hiddenProjectTypes, type]
      const serialized = serializeHiddenProjectTypes(next)
      changeScope({ hiddenProjectTypes: next }, params => {
        if (serialized) {
          params.set(HIDE_PARAM, serialized)
        } else {
          params.delete(HIDE_PARAM)
        }
      })
    },
    [changeScope, hiddenProjectTypes]
  )

  const items = useMemo(
    () =>
      sortedClients.map(client => ({
        value: client.id,
        label: client.name,
        // The id keeps two same-named clients distinct rows for cmdk.
        keywords: [client.id],
      })),
    [sortedClients]
  )

  // The shared filter trigger: "All clients" (plus what the Show group
  // hides) as the placeholder, the picked client with a clear ×.
  return (
    <SearchableCombobox
      items={items}
      value={isAllClients ? null : selectedClientId}
      onChange={companyId => handleSelectClient(companyId || ALL_CLIENTS_VALUE)}
      onClear={() => handleSelectClient(ALL_CLIENTS_VALUE)}
      clearLabel='client'
      ariaLabel='Client scope'
      placeholder={
        hiddenHint ? `${ALL_CLIENTS_LABEL} · ${hiddenHint}` : ALL_CLIENTS_LABEL
      }
      searchPlaceholder='Search clients…'
      emptyMessage='No clients found.'
      disabled={disabled}
      className={FILTER_TRIGGER_WIDTH}
      listHeader={
        <>
          <CommandGroup heading='Show'>
            {SCOPE_ROWS.map(row => (
              <ClientScopeRow
                key={row.type}
                label={row.label}
                checked={!hiddenProjectTypes.includes(row.type)}
                disabled={!isAllClients}
                onToggle={() => handleToggleType(row.type)}
              />
            ))}
            {!isAllClients ? (
              <p className='text-muted-foreground px-2 pt-1 pb-1.5 text-xs'>
                Applies under All clients.
              </p>
            ) : null}
          </CommandGroup>
          <CommandSeparator />
        </>
      }
    />
  )
}
