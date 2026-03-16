'use client'

import { Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { GitHubRepoLinkSummary } from '@/lib/types'

type PlanSettingsPopoverProps = {
  githubRepos: GitHubRepoLinkSummary[]
  selectedRepoId: string
  onRepoChange: (repoId: string) => void
}

export function PlanSettingsPopover({
  githubRepos,
  selectedRepoId,
  onRepoChange,
}: PlanSettingsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='icon' className='h-7 w-7'>
          <Settings className='h-4 w-4' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-64' align='end'>
        <div className='flex flex-col gap-3'>
          <div>
            <label className='text-xs font-medium text-muted-foreground'>
              Repository
            </label>
            <Select value={selectedRepoId} onValueChange={onRepoChange}>
              <SelectTrigger className='mt-1 h-8 text-xs'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {githubRepos.map(repo => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.repoFullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
