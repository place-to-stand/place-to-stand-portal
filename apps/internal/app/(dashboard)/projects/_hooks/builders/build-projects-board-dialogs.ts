import type { ProjectsBoardDialogsProps } from '../../_components/projects-board-dialogs'

type BuildDialogsArgs = {
  activeProject: ProjectsBoardDialogsProps['activeProject']
  sheetState: ProjectsBoardDialogsProps['sheetState']
  projects: ProjectsBoardDialogsProps['projects']
}

export function buildProjectsBoardDialogs({
  activeProject,
  sheetState,
  projects,
}: BuildDialogsArgs): ProjectsBoardDialogsProps {
  return {
    activeProject,
    sheetState,
    projects,
  }
}
