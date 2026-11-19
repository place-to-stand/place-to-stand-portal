'use client'

import { usePathname, useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'

import { TEMPLATE_KINDS } from '../_lib/tabs'

/**
 * Emails / PDFs / Chat messages, in the Templates filter bar: the same small
 * toggle as the notifications' All / Unread / Archived, so Templates stays
 * one Reference tab.
 */
export function TemplateKindSwitch() {
  const pathname = usePathname()
  const router = useRouter()
  const current =
    TEMPLATE_KINDS.find(kind => pathname.startsWith(kind.href))?.value ??
    'emails'
  return (
    <Tabs
      value={current}
      onValueChange={value => {
        const kind = TEMPLATE_KINDS.find(item => item.value === value)
        if (kind) router.push(kind.href)
      }}
    >
      <TabsList className='h-7' aria-label='Template kind'>
        {TEMPLATE_KINDS.map(kind => (
          <TabsTrigger
            key={kind.value}
            value={kind.value}
            className='px-2 py-0.5 text-xs'
          >
            {kind.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
