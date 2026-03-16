import { redirect } from 'next/navigation'

const DEFAULT_VIEW = 'board'

export default function TasksIndexRoute() {
  redirect(`/my/tasks/${DEFAULT_VIEW}`)
}

