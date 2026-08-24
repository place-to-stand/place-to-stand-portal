'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { Users } from 'lucide-react'

import { SearchableCombobox, type SearchableComboboxItem } from '@/components/ui/searchable-combobox'
import type { DbUser } from '@/lib/types'

import { ALL_SESSIONS_OWNER } from '../owner-scope'

type SessionOwnerSelectorProps = {
  admins: DbUser[]
  /** An admin id, or `'all'` for the everyone view. */
  selectedOwnerId: string
  currentUserId: string
  disabled?: boolean
}

/**
 * Same pattern as My Tasks' PersonSelector (components/my-tasks/person-selector.tsx),
 * just scoped to sessions instead of task assignees — kept as its own small
 * component rather than generalizing PersonSelector, since that one is
 * hardcoded to the `assignee` param and already has a working call site.
 */
export function SessionOwnerSelector({ admins, selectedOwnerId, currentUserId, disabled = false }: SessionOwnerSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items: SearchableComboboxItem[] = useMemo(() => {
    const mappedItems = admins.map(admin => ({
      value: admin.id,
      label: admin.full_name ?? admin.email ?? 'Unknown',
      avatarUrl: admin.avatar_url,
      userId: admin.id,
    }))

    mappedItems.sort((a, b) => {
      if (a.userId === currentUserId) return -1
      if (b.userId === currentUserId) return 1
      return a.label.localeCompare(b.label)
    })

    return [
      {
        value: ALL_SESSIONS_OWNER,
        label: 'All sessions',
        keywords: ['all', 'everyone'],
        icon: Users,
      },
      ...mappedItems,
    ]
  }, [admins, currentUserId])

  const handleChange = useCallback(
    (ownerId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('owner', ownerId)

      const search = params.toString()
      const url = search ? `${pathname}?${search}` : pathname

      router.push(url, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <SearchableCombobox
      items={items}
      value={selectedOwnerId}
      onChange={handleChange}
      placeholder='Select owner'
      searchPlaceholder='Search team members...'
      emptyMessage='No team members found.'
      disabled={disabled}
      className='w-full'
      triggerClassName='h-7 py-0 text-xs'
    />
  )
}
