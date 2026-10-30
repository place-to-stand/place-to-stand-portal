'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'

import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ProjectSheetWrapper({ value, open, onRequestClose }: SheetWrapperProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { getAux } = useSheetParams()
  const data = useSheetInit('project', value)
  // A company's Projects tab passes its id along.
  const initialCompanyId =
    value === NEW_SHEET_VALUE
      ? (getAux('projectCompanyId') ?? undefined)
      : undefined

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
        // A company sheet underneath lists its projects.
        void queryClient.invalidateQueries({ queryKey: ['companyClientWork'] })
        onRequestClose()
      }}
      project={data.project}
      initialCompanyId={initialCompanyId}
      clients={data.clients}
      adminUsers={data.adminUsers}
      contractorDirectory={[]}
      projectContractors={{}}
    />
  )
}
