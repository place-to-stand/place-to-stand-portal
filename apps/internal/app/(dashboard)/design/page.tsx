import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'

import {
  ComponentsBadges,
  ComponentsButtons,
} from './_components/components-actions'
import {
  ComponentsAvatars,
  ComponentsRecordRows,
  ComponentsTables,
} from './_components/components-data'
import { ComponentsBulkSelect } from './_components/components-bulk-select'
import {
  ComponentsDates,
  ComponentsRichText,
} from './_components/components-dates'
import {
  ComponentsDialogs,
  ComponentsEmptyLoading,
  ComponentsFeedback,
  ComponentsOverlays,
} from './_components/components-feedback'
import {
  ComponentsInputs,
  ComponentsPickers,
  ComponentsToggles,
} from './_components/components-forms'
import {
  ComponentsPageShell,
  ComponentsTabs,
  ComponentsTextLinks,
} from './_components/components-navigation'
import { ComponentsSheets } from './_components/components-sheet'
import { ComponentsStats } from './_components/components-stats'
import { ComponentsAccess } from './_components/components-access'
import { FoundationsColour } from './_components/foundations-colour'
import { FoundationsEntities } from './_components/foundations-entities'
import { FoundationsIcons } from './_components/foundations-icons'
import {
  FoundationsRadius,
  FoundationsSpace,
  FoundationsType,
} from './_components/foundations-scales'
import { GuideShell } from './_components/guide-shell'
import { PatternsCopy, PatternsHouseRules } from './_components/patterns'

export const metadata: Metadata = {
  title: 'Design',
}

/**
 * The living style guide. Not in the nav: reachable at /design, admin-only
 * (requireUser). Every specimen renders the real component with inline
 * sample data; nothing here writes.
 */
export default async function DesignPage() {
  await requirePage('settings.design')

  return (
    <PageShell breadcrumbs={[{ label: 'Design' }]}>
      <GuideShell>
        <FoundationsColour />
        <FoundationsEntities />
        <FoundationsType />
        <FoundationsSpace />
        <FoundationsRadius />
        <FoundationsIcons />

        <ComponentsButtons />
        <ComponentsBadges />
        <ComponentsInputs />
        <ComponentsPickers />
        <ComponentsToggles />
        <ComponentsDates />
        <ComponentsRichText />
        <ComponentsAvatars />
        <ComponentsRecordRows />
        <ComponentsStats />
        <ComponentsAccess />
        <ComponentsTables />
        <ComponentsBulkSelect />
        <ComponentsEmptyLoading />
        <ComponentsFeedback />
        <ComponentsOverlays />
        <ComponentsDialogs />
        <ComponentsSheets />
        <ComponentsTabs />
        <ComponentsTextLinks />
        <ComponentsPageShell />

        <PatternsHouseRules />
        <PatternsCopy />
      </GuideShell>
    </PageShell>
  )
}
