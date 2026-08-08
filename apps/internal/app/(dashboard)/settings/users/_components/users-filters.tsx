'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  USER_ACCESS_LABELS,
  USER_ACCESS_VALUES,
  USER_ROLE_LABELS,
  USER_ROLE_VALUES,
  type UserAccessFilter,
} from '@/lib/settings/users/filters'
import type { UserRoleValue } from '@/lib/types'

const ALL = 'all'

type UsersFiltersProps = {
  role?: UserRoleValue
  /** Access filter value — active tab only (archived rows render `—`). */
  access?: UserAccessFilter
  showAccessFilter: boolean
  /** Base path to push filter changes to — '/settings/users' or '/settings/users/archive'. */
  basePath: string
}

export function UsersFilters({
  role,
  access,
  showAccessFilter,
  basePath,
}: UsersFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }

      router.push(`${basePath}?${next.toString()}`)
    },
    [basePath, router, searchParams]
  )

  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
      <Select
        value={role ?? ALL}
        onValueChange={value =>
          // Filter changes clear the keyset cursor — a stale cursor against a
          // freshly filtered set must be impossible.
          updateParams({
            role: value === ALL ? undefined : value,
            cursor: undefined,
            dir: undefined,
          })
        }
      >
        <SelectTrigger className='w-[160px]'>
          <SelectValue placeholder='All users' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All users</SelectItem>
          {USER_ROLE_VALUES.map(value => (
            <SelectItem key={value} value={value}>
              {USER_ROLE_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showAccessFilter ? (
        <Select
          value={access ?? ALL}
          onValueChange={value =>
            updateParams({
              access: value === ALL ? undefined : value,
              cursor: undefined,
              dir: undefined,
            })
          }
        >
          <SelectTrigger className='w-[160px]'>
            <SelectValue placeholder='All access' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All access</SelectItem>
            {USER_ACCESS_VALUES.map(value => (
              <SelectItem key={value} value={value}>
                {USER_ACCESS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
