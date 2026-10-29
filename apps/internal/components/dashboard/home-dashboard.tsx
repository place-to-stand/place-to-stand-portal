'use client'

import { EmptyState } from '@pts/ui/empty-state'
import { PageShell } from '@/components/layout/page-shell'
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
