import type {
  ProjectWithClient as SheetProjectWithClient,
} from '@/lib/projects/sheet/project-sheet-form'

export type ProjectWithClient = SheetProjectWithClient

export type ContractorUserSummary = {
  id: string
  email: string
  fullName: string | null
}
export type ProjectsTableMode = 'active' | 'archive'
