'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { ProjectSheet } from '@/app/(dashboard)/projects/project-sheet'

import { useCreatePrefill } from './use-create-prefill'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function ProjectSheetWrapper({
  value,
  open,
  aux,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const data = useSheetInit('project', value)
  // A company's Projects (its sheet's Client column) passes its id along.
  const initialCompanyId = useCreatePrefill(value, aux, [
    'projectCompanyId',
  ] as const).projectCompanyId

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
