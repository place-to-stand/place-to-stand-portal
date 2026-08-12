'use client'

import { useRouter } from 'next/navigation'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'

import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ProjectSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const data = useSheetInit('project', value)

  if (!data) {
    return null
  }

  return (
    <ProjectSheet
      open={open}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
        }
      }}
      onComplete={() => {
        router.refresh()
        onRequestClose()
      }}
      project={data.project}
      clients={data.clients}
      adminUsers={data.adminUsers}
      contractorDirectory={[]}
      projectContractors={{}}
    />
  )
}
