import {
  Archive,
  ArrowRightLeft,
  Inbox,
  Paperclip,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileText,
  GitBranch,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { BADGE_TINTS } from '@pts/ui/badge-tints'

/**
 * Icon + colour tone for each activity verb family. Tone is only ever a
 * secondary cue — the summary sentence carries the meaning — so a verb that
 * misses this table still renders fine with the neutral fallback.
 */
export type ActivityTone =
  | 'create'
  | 'update'
  | 'status'
  | 'archive'
  | 'delete'
  | 'comment'
  | 'time'
  | 'money'
  | 'view'
  | 'integration'
  | 'neutral'

export type VerbPresentation = {
  icon: LucideIcon
  tone: ActivityTone
}

/** Rail-icon tints, from the shared badge recipe so hues match status badges. */
const TONE_CLASSES: Record<ActivityTone, string> = {
  create: BADGE_TINTS.emerald,
  update: BADGE_TINTS.sky,
  status: BADGE_TINTS.violet,
  archive: BADGE_TINTS.neutral,
  delete: BADGE_TINTS.rose,
  comment: BADGE_TINTS.amber,
  time: BADGE_TINTS.teal,
  money: BADGE_TINTS.emerald,
  view: BADGE_TINTS.neutral,
  integration: BADGE_TINTS.orange,
  neutral: BADGE_TINTS.neutral,
}

export function getToneClasses(tone: ActivityTone): string {
  return TONE_CLASSES[tone]
}

const EXACT: Record<string, VerbPresentation> = {
  TASK_STATUS_CHANGED: { icon: ArrowRightLeft, tone: 'status' },
  LEAD_STATUS_CHANGED: { icon: ArrowRightLeft, tone: 'status' },
  TASK_ACCEPTED: { icon: CheckCircle2, tone: 'create' },
  TASKS_ACCEPTED: { icon: CheckCircle2, tone: 'create' },
  TASK_ACCEPTANCE_REVERTED: { icon: RotateCcw, tone: 'status' },
  TIME_LOG_CREATED: { icon: Clock, tone: 'time' },
  INVOICE_SENT: { icon: Send, tone: 'money' },
  INVOICE_PAID: { icon: DollarSign, tone: 'money' },
  INVOICE_VOIDED: { icon: XCircle, tone: 'delete' },
  INVOICE_UNSENT: { icon: RotateCcw, tone: 'status' },
  PROPOSAL_SENT: { icon: Send, tone: 'update' },
  PROPOSAL_ACCEPTED: { icon: CheckCircle2, tone: 'create' },
  PROPOSAL_COUNTERSIGNED: { icon: CheckCircle2, tone: 'create' },
  PROPOSAL_REJECTED: { icon: XCircle, tone: 'delete' },
  CONTACT_INVITED_TO_PORTAL: { icon: UserPlus, tone: 'create' },
  USER_CREATED: { icon: UserPlus, tone: 'create' },
  LEAD_CONVERTED: { icon: Sparkles, tone: 'create' },
  LEAD_UPDATE_LOGGED: { icon: MessageSquare, tone: 'comment' },
  LEAD_UPDATE_EDITED: { icon: MessageSquare, tone: 'comment' },
  LEAD_UPDATE_DELETED: { icon: MessageSquare, tone: 'delete' },
  TASK_ATTACHMENT_ADDED: { icon: Paperclip, tone: 'create' },
  TASK_ATTACHMENT_REMOVED: { icon: Paperclip, tone: 'archive' },
  TASK_WORKER_STATUS_CHANGED: { icon: Sparkles, tone: 'status' },
  CLIENT_UPDATE_SENT: { icon: Mail, tone: 'create' },
  CLIENT_UPDATE_DRAFTED: { icon: Mail, tone: 'neutral' },
  CLIENT_UPDATE_EDITED: { icon: Mail, tone: 'update' },
  CONTACT_CLIENT_LINKED: { icon: Link2, tone: 'create' },
  CONTACT_CLIENT_UNLINKED: { icon: Link2, tone: 'archive' },
  USER_PASSWORD_CHANGED: { icon: Lock, tone: 'update' },
  SUBMISSION_RECEIVED: { icon: Inbox, tone: 'create' },
  SUBMISSIONS_ABANDONED: { icon: Archive, tone: 'archive' },
  MONTHLY_CLOSE_RECLOSED: { icon: Lock, tone: 'money' },
  PLANNING_SESSION_CREATED: { icon: Sparkles, tone: 'create' },
  PLAN_REVISION_CREATED: { icon: Sparkles, tone: 'update' },
  TIME_LOG_UPDATED: { icon: Clock, tone: 'update' },
  TIME_LOG_DELETED: { icon: Clock, tone: 'delete' },
  TASK_CREATED_FROM_EMAIL: { icon: Mail, tone: 'create' },
  OAUTH_CONNECTED: { icon: Lock, tone: 'integration' },
  OAUTH_DISCONNECTED: { icon: Lock, tone: 'archive' },
  OAUTH_REFRESHED: { icon: Lock, tone: 'integration' },
  OAUTH_EXPIRED: { icon: Lock, tone: 'delete' },
  MONTHLY_CLOSE_CLOSED: { icon: Lock, tone: 'money' },
  MONTHLY_CLOSE_REOPENED: { icon: RotateCcw, tone: 'status' },
  GITHUB_PR_CREATED: { icon: GitBranch, tone: 'integration' },
  PR_CREATED_FROM_SUGGESTION: { icon: GitBranch, tone: 'integration' },
}

const FALLBACK: VerbPresentation = { icon: FileText, tone: 'neutral' }

export function getVerbPresentation(verb: string): VerbPresentation {
  const exact = EXACT[verb]
  if (exact) return exact

  if (verb.endsWith('_VIEWED')) return { icon: Eye, tone: 'view' }
  if (verb.endsWith('_DELETED') || verb.endsWith('_DESTROYED')) {
    return { icon: Trash2, tone: 'delete' }
  }
  if (verb.endsWith('_ARCHIVED') || verb.endsWith('_UNSHARED')) {
    return { icon: Archive, tone: 'archive' }
  }
  if (verb.endsWith('_RESTORED')) return { icon: RotateCcw, tone: 'status' }
  if (verb.includes('COMMENT')) return { icon: MessageSquare, tone: 'comment' }
  if (verb.includes('GITHUB') || verb.includes('INTEGRATION')) {
    return { icon: Link2, tone: 'integration' }
  }
  if (verb.includes('WORKER') || verb.includes('SUGGESTION')) {
    return { icon: Sparkles, tone: 'integration' }
  }
  if (verb.endsWith('_CREATED') || verb.endsWith('_SHARED')) {
    return { icon: Plus, tone: 'create' }
  }
  if (verb.endsWith('_UPDATED') || verb.endsWith('_CHANGED')) {
    return { icon: Pencil, tone: 'update' }
  }

  return FALLBACK
}
