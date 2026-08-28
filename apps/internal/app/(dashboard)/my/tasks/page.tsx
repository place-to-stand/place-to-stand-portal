import { redirect } from 'next/navigation'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const DEFAULT_VIEW = 'board'

export default function TasksIndexRoute() {
  redirect(`/my/tasks/${DEFAULT_VIEW}`)
}

