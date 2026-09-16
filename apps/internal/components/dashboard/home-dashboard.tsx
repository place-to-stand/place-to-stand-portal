'use client'

import { PageShell } from '@/components/layout/page-shell'
import type { DashboardLayout } from '@/lib/dashboard/layout'

import { DashboardWidgetGrid } from './widget-layout/dashboard-widget-grid'
import { LayoutEditControls } from './widget-layout/layout-edit-controls'
import type { DashboardWidgetData } from './widget-layout/types'
import { useDashboardLayoutEditor } from './widget-layout/use-dashboard-layout-editor'

type HomeDashboardProps = DashboardWidgetData & {
  initialLayout: DashboardLayout
}

export function HomeDashboard({
  tasks,
  totalTaskCount,
  initialHoursSnapshot,
  initialLayout,
}: HomeDashboardProps) {
  const editor = useDashboardLayoutEditor({ initialLayout })

  return (
    <PageShell
      breadcrumbs={[{ label: 'Home' }]}
      headerRight={
        <LayoutEditControls
          isEditing={editor.isEditing}
          canReset={!editor.isDefault}
          onStartEditing={editor.startEditing}
          onStopEditing={editor.stopEditing}
          onReset={editor.reset}
        />
      }
    >
      <DashboardWidgetGrid
        layout={editor.layout}
        data={{ tasks, totalTaskCount, initialHoursSnapshot }}
        isEditing={editor.isEditing}
        onDragStart={editor.handleDragStart}
        onDragOver={editor.handleDragOver}
        onDragEnd={editor.handleDragEnd}
        onDragCancel={editor.handleDragCancel}
      />
    </PageShell>
  )
}
