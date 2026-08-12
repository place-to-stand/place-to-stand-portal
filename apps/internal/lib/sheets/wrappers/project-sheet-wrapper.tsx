'use client'

import { useRouter } from 'next/navigation'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'

import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ProjectSheetWrapper({ value }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('project', value)

  if (!data) {
    return null
  }

  return (
    <ProjectSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('project')
        }
      }}
      onComplete={() => {
        router.refresh()
        close('project')
      }}
      project={data.project}
      clients={data.clients}
      adminUsers={data.adminUsers}
      contractorDirectory={[]}
      projectContractors={{}}
    />
  )
}
