'use client'

import { EmptyState } from '@pts/ui/empty-state'
import { PageShell } from '@/components/layout/page-shell'
import type { TabsNavTab } from '@/components/layout/tabs-nav'
import type { Role } from '@/lib/auth/capabilities'
import type { DashboardLayout } from '@/lib/dashboard/layout'

import { DashboardWidgetGrid } from './widget-layout/dashboard-widget-grid'
import { LayoutEditControls } from './widget-layout/layout-edit-controls'
import type { DashboardWidgetData } from './widget-layout/types'
import { useDashboardLayoutEditor } from './widget-layout/use-dashboard-layout-editor'

type HomeDashboardProps = DashboardWidgetData & {
  initialLayout: DashboardLayout
  role: Role
}

const HOME_TABS = [
  { label: 'Home', value: 'home', href: '/my/home' },
] satisfies readonly TabsNavTab[]

export function HomeDashboard({
  tasks,
  totalTaskCount,
  initialHoursSnapshot,
  sales,
  initialLayout,
  role,
}: HomeDashboardProps) {
  const editor = useDashboardLayoutEditor({ initialLayout, role })

  return (
    <PageShell
      breadcrumbs={[{ label: 'Home' }]}
      // One tab, like any page without others, so the toolbar row lines up
      // with My Tasks and the lists.
      tabs={HOME_TABS}
      activeTab='home'
      primaryAction={
        <LayoutEditControls
          isEditing={editor.isEditing}
          canReset={!editor.isDefault}
          onStartEditing={editor.startEditing}
          onStopEditing={editor.stopEditing}
          onReset={editor.reset}
        />
      }
    >
      {!editor.isEditing && editor.layout.columns.every(c => c.length === 0) ? (
        <EmptyState
          message='Every widget is hidden.'
          onClick={editor.startEditing}
          label='Edit widgets to show some'
        />
      ) : null}
      <DashboardWidgetGrid
        layout={editor.layout}
        data={{ tasks, totalTaskCount, initialHoursSnapshot, sales }}
        isEditing={editor.isEditing}
        onHideWidget={editor.hide}
        onShowWidget={editor.show}
        onDragStart={editor.handleDragStart}
        onDragOver={editor.handleDragOver}
        onDragEnd={editor.handleDragEnd}
        onDragCancel={editor.handleDragCancel}
      />
    </PageShell>
  )
}
