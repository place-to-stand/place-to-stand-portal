'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import { cn } from '@/lib/utils'

type ProjectsAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

export function ProjectsAddButton({
  clients,
  className,
}: ProjectsAddButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleComplete = () => {
    setOpen(false)
    router.refresh()
  }

  const createDisabled = clients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null

  return (
    <div className={cn(className)}>
      <DisabledFieldTooltip
        disabled={createDisabled}
        reason={createDisabledReason}
      >
        <Button
          size='sm'
          type='button'
          onClick={() => setOpen(true)}
          disabled={createDisabled}
          className='gap-2'
        >
          <Plus className='h-4 w-4' />
          Add project
        </Button>
      </DisabledFieldTooltip>
      <ProjectSheet
        open={open}
        onOpenChange={setOpen}
        onComplete={handleComplete}
        project={null}
        clients={clients}
        contractorDirectory={[]}
        projectContractors={{}}
      />
    </div>
  )
}
