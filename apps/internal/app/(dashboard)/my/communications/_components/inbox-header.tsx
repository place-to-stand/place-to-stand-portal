'use client'

import { AppShellHeader } from '@/components/layout/app-shell'

export function InboxHeader() {
  return (
    <AppShellHeader>
      <h1 className='text-2xl font-semibold tracking-tight'>Communications</h1>
      <p className='text-muted-foreground text-sm'>
        View and manage synced emails and transcripts.
      </p>
    </AppShellHeader>
  )
}
