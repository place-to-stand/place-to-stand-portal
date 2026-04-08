import { TASK_STATUS_TOKENS } from '@/lib/projects/task-status'

export const TASK_STATUSES = [
  {
    value: 'ON_DECK',
    label: 'On Deck',
    token: TASK_STATUS_TOKENS.ON_DECK,
  },
  {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    token: TASK_STATUS_TOKENS.IN_PROGRESS,
  },
  {
    value: 'BLOCKED',
    label: 'Blocked',
    token: TASK_STATUS_TOKENS.BLOCKED,
  },
  { value: 'DONE', label: 'Done', token: TASK_STATUS_TOKENS.DONE },
]

export const UNASSIGNED_ASSIGNEE_VALUE = '__UNASSIGNED__'

export const MANAGE_PERMISSION_REASON =
  'You need manage permissions to edit this task.'

export const PENDING_REASON = 'Please wait for the current request to finish.'
