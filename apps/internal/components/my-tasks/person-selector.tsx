'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { Users } from 'lucide-react'

import { FILTER_TRIGGER_WIDTH } from '@/components/ui/field-trigger'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import type { DbUser } from '@/lib/types'
import { isSelectableUser } from '@/lib/users/selectable'

const ALL_TASKS_VALUE = 'all'

type PersonSelectorProps = {
  admins: Pick<
    DbUser,
    'id' | 'full_name' | 'email' | 'avatar_url' | 'disabled_at' | 'deleted_at'
  >[]
  /** An admin id, or `'all'` for the everyone view. */
  selectedUserId: string
  currentUserId: string
  disabled?: boolean
  /** The everyone option's label ("All tasks" on My tasks, "All leads" on Leads). */
  allLabel?: string
}

export function PersonSelector({
  admins,
  selectedUserId,
  currentUserId,
  disabled = false,
  allLabel = 'All tasks',
}: PersonSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items: SearchableComboboxItem[] = useMemo(() => {
    // Disabled admins are not offered, but a board already scoped to one
    // (via the URL) keeps them as a disabled entry so the trigger is named.
    const mappedItems = admins
      .filter(admin => isSelectableUser(admin) || admin.id === selectedUserId)
      .map(admin => ({
        value: admin.id,
        label: admin.full_name ?? admin.email ?? 'Unknown',
        avatarUrl: admin.avatar_url,
        userId: admin.id,
        disabled: !isSelectableUser(admin),
      }))

    // Sort: current user first, then alphabetically by label
    mappedItems.sort((a, b) => {
      if (a.userId === currentUserId) return -1
      if (b.userId === currentUserId) return 1
      return a.label.localeCompare(b.label)
    })

    // Everyone's tasks — for the weekly planning walk-through.
    return [
      {
        value: ALL_TASKS_VALUE,
        label: allLabel,
        keywords: ['all', 'everyone'],
        icon: Users,
      },
      ...mappedItems,
    ]
  }, [admins, allLabel, currentUserId, selectedUserId])

  const handleChange = useCallback(
    (userId: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (userId) {
        params.set('assignee', userId)
      } else {
        params.delete('assignee')
      }

      // Person-scoped sort metadata has no meaning across boards, and the
      // sheet params should survive the switch untouched.

      const search = params.toString()
      const url = search ? `${pathname}?${search}` : pathname

      router.push(url, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // The shared filter trigger, at the filter width beside the client scope.
  return (
    <SearchableCombobox
      items={items}
      value={selectedUserId}
      onChange={handleChange}
      ariaLabel='Person'
      placeholder='Select person'
      searchPlaceholder='Search people…'
      emptyMessage='No people found.'
      disabled={disabled}
      className={FILTER_TRIGGER_WIDTH}
      itemClassName='whitespace-nowrap'
    />
  )
}
