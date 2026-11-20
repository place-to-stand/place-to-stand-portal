'use client'

import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

import { writeShallowUrl } from '@/lib/sheets/shallow-url'

/** The Account sheet's sections, in order; each is a value of `?account=`. */
const ACCOUNT_SECTIONS = ['profile', 'integrations', 'preferences'] as const

type AccountSection = (typeof ACCOUNT_SECTIONS)[number]

const ACCOUNT_PARAM = 'account'

const isSection = (value: string | null): value is AccountSection =>
  (ACCOUNT_SECTIONS as readonly string[]).includes(value ?? '')

/**
 * The link to the Account sheet on the current page: `?account=<section>`,
 * every other param kept. For a plain `<a>` outside React state (a toast,
 * an OAuth return), `/my/home?account=integrations` works the same.
 */
function accountSheetHref(section: AccountSection = 'profile') {
  const url = new URL(window.location.href)
  url.searchParams.set(ACCOUNT_PARAM, section)
  return `${url.pathname}${url.search}${url.hash}`
}

/** Opens the Account sheet over the current page (a history entry). */
export function openAccountSheet(section: AccountSection = 'profile') {
  writeShallowUrl(accountSheetHref(section), 'push')
}

/**
 * The signed-in person's own settings (profile, their integrations,
 * preferences) live in one sheet over whatever page is open, addressed by
 * `?account=<section>` so it deep-links and survives a reload. It is not a
 * record, so it sits outside the entity sheet stack: opening it pushes a
 * history entry, closing replaces one, and the page is never reloaded.
 */
export function useAccountSheet() {
  const params = useSearchParams()
  const raw = params.get(ACCOUNT_PARAM)
  // Any value opens it; an unknown one lands on Profile.
  const section: AccountSection | null =
    raw === null ? null : isSection(raw) ? raw : 'profile'

  const close = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete(ACCOUNT_PARAM)
    writeShallowUrl(`${url.pathname}${url.search}${url.hash}`, 'replace')
  }, [])

  return { section, isOpen: section !== null, close }
}
