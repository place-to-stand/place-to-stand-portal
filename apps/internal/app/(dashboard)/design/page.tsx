import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'

import { Foundations } from './_components/foundations'
import { PrimitivesButtons } from './_components/primitives-buttons'
import { PrimitivesDisplay } from './_components/primitives-display'
import { PrimitivesForms } from './_components/primitives-forms'
import { PrimitivesOverlays } from './_components/primitives-overlays'
import { ShellSpecimens } from './_components/shell-specimens'

export const metadata: Metadata = {
  title: 'Design',
}

const SECTIONS = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'buttons', label: 'Buttons & badges' },
  { id: 'forms', label: 'Form controls' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'display', label: 'Display & data' },
  { id: 'shell', label: 'Shell specimens' },
] as const

/**
 * Hidden style guide (PRD 004 §05). Not in the nav — reachable only at
 * /design. Auth is inherited from the dashboard layout; every specimen is
 * static inline data. The page header above is itself the PageShell specimen.
 */
export default function DesignPage() {
  return (
    <PageShell breadcrumbs={[{ label: 'Design' }]}>
      <div className='space-y-10'>
        <nav
          aria-label='Style guide sections'
          className='bg-background/95 sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 backdrop-blur'
        >
          {SECTIONS.map(section => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className='text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2.5 py-1 text-sm transition-colors'
            >
              {section.label}
            </a>
          ))}
        </nav>

        <Foundations />
        <PrimitivesButtons />
        <PrimitivesForms />
        <PrimitivesOverlays />
        <PrimitivesDisplay />
        <ShellSpecimens />
      </div>
    </PageShell>
  )
}
