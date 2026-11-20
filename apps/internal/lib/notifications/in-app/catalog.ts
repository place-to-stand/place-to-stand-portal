import type { NotificationType } from './types'

type InAppNotificationEntry = {
  type: NotificationType
  /** Short name, as a heading. */
  name: string
  /** What it looks like in the bell, with sample names. */
  sample: { title: string; body?: string }
  /** Who gets it. */
  recipients: string
  /** What sets it off. */
  when: string
  /** What doesn't, so nobody waits for one that won't come. */
  notWhen: string
}

type InAppNotificationGroup = {
  title: string
  entries: InAppNotificationEntry[]
}

const NEVER_YOURS =
  'Never for something you did yourself, or a record you can no longer open.'

/**
 * Every in-app notification (the bell and Home's My notifications), for
 * Reference → Notifications. Keep it in step with the producers in
 * `events.ts` and the due-date sync in `queries.ts`: a new kind adds an
 * entry here in the same change. `task_due_today` is retired (old rows still
 * show in the feed) and so is not listed.
 */
export const IN_APP_NOTIFICATIONS: InAppNotificationGroup[] = [
  {
    title: 'Tasks',
    entries: [
      {
        type: 'task_assigned',
        name: 'Assigned to you',
        sample: {
          title: 'Alex Rivera assigned you a task',
          body: 'Send Param the server config notes',
        },
        recipients: 'Each person newly added as an assignee.',
        when: 'Someone else creates a task with you on it, or adds you to one.',
        notWhen: `${NEVER_YOURS} Not when you stay on a task you were already on.`,
      },
      {
        type: 'task_comment',
        name: 'New comment',
        sample: {
          title: 'Alex Rivera commented on Homepage mobile pass',
          body: 'Pushed the fix for the nav overlap, can you check on your phone?',
        },
        recipients: "The task's assignees and the person who created it.",
        when: 'Someone else comments on the task.',
        notWhen: NEVER_YOURS,
      },
      {
        type: 'task_status',
        name: 'Blocked or done',
        sample: { title: 'Alex Rivera marked Homepage mobile pass done' },
        recipients: "The task's assignees and the person who created it.",
        when: 'Someone else moves the task to Blocked or Done, from the board or the task sheet.',
        notWhen: `${NEVER_YOURS} Other status changes (On deck, In progress) send nothing.`,
      },
      {
        type: 'task_overdue',
        name: 'Overdue',
        sample: {
          title: 'Overdue: Send Param the server config notes',
          body: 'Was due 2026-11-11',
        },
        recipients: 'Each assignee who can work the task.',
        when: 'The morning after an open task’s due date (business time zone), once per due date.',
        notWhen:
          'Not for Done or accepted tasks, and not on the due date itself: My Tasks shows what’s due today.',
      },
    ],
  },
  {
    title: 'Leads',
    entries: [
      {
        type: 'lead_assigned',
        name: 'Assigned to you',
        sample: {
          title: 'Sam Lee assigned you a lead',
          body: 'Ada Lovelace · Acme Co',
        },
        recipients: 'The new owner of the lead.',
        when: 'Someone else creates a lead for you or makes you its owner.',
        notWhen: NEVER_YOURS,
      },
      {
        type: 'lead_update',
        name: 'New update',
        sample: {
          title: 'Sam Lee logged a phone call on Ada Lovelace',
          body: 'Wants a quote for the wholesale portal by Friday.',
        },
        recipients: "The lead's owner.",
        when: 'Someone else logs a meeting, call, text, email or note on the lead.',
        notWhen: NEVER_YOURS,
      },
      {
        type: 'lead_stage',
        name: 'Moved to another stage',
        sample: { title: 'Sam Lee moved Ada Lovelace to Proposal sent' },
        recipients: "The lead's owner.",
        when: 'Someone else moves the lead to another stage, on the board or in the lead sheet.',
        notWhen: `${NEVER_YOURS} Reordering a lead within its stage sends nothing.`,
      },
    ],
  },
  {
    title: 'Connections',
    entries: [
      {
        type: 'connection_reauth',
        name: 'Reconnect',
        sample: {
          title: 'Reconnect Google',
          body: 'ada@example.com stopped working. Lead emails won’t sync until you reconnect it.',
        },
        recipients: 'The person who connected it.',
        when: 'Google, GitHub, Vercel or Supabase refuses a saved connection (it expired or was revoked), so the portal can’t use it any more.',
        notWhen:
          'Only once each time it breaks, not on every failed try. Not when you disconnect it yourself.',
      },
    ],
  },
]
