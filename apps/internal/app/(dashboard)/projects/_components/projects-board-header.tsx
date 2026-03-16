import { useEffect } from 'react'

import { Label } from '@/components/ui/label'
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

export type BoardHeaderItem = SearchableComboboxItem
export type BoardHeaderItemGroup = SearchableComboboxGroup

type ProjectsBoardHeaderProps = {
  projectItems: BoardHeaderItem[]
  projectGroups?: BoardHeaderItemGroup[]
  selectedProjectId: string | null
  onProjectChange: (projectId: string | null) => void
  onSelectNextProject: () => void
  onSelectPreviousProject: () => void
  canSelectNext: boolean
  canSelectPrevious: boolean
}

export function ProjectsBoardHeader({
  projectItems,
  projectGroups,
  selectedProjectId,
  onProjectChange,
  onSelectNextProject,
  onSelectPreviousProject,
  canSelectNext,
  canSelectPrevious,
}: ProjectsBoardHeaderProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key === '[' && canSelectPrevious) {
        e.preventDefault()
        onSelectPreviousProject()
      } else if (e.key === ']' && canSelectNext) {
        e.preventDefault()
        onSelectNextProject()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canSelectNext, canSelectPrevious, onSelectNextProject, onSelectPreviousProject])

  return (
    <div className='min-w-[400px] flex-1 space-y-2'>
      <Label htmlFor='projects-project-select' className='sr-only'>
        Project Selector
      </Label>
      <SearchableCombobox
        id='projects-project-select'
        items={projectItems}
        groups={projectGroups}
        value={selectedProjectId ?? ''}
        onChange={value => onProjectChange(value || null)}
        placeholder='Select a project...'
        searchPlaceholder='Search clients or projects...'
        disabled={projectItems.length === 0}
        ariaLabel='Select a project'
        variant='heading'
      />
    </div>
  )
}
