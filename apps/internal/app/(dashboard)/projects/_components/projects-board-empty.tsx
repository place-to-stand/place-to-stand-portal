import { EmptyState } from '@pts/ui/empty-state'

type ProjectsBoardEmptyProps = {
  /** One plain sentence, per the EmptyState rules. */
  message: string
}

/** A full-height EmptyState for boards and board tabs. */
export function ProjectsBoardEmpty({ message }: ProjectsBoardEmptyProps) {
  return <EmptyState message={message} className='h-full justify-center' />
}
