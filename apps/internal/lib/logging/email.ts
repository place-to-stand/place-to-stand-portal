/**
 * Structured logging for email operations.
 * Outputs JSON logs with consistent context for observability.
 */

type LogLevel = 'info' | 'warn' | 'error'

interface EmailLogContext {
  userId?: string
  draftId?: string
  messageId?: string
  threadId?: string
  recipientCount?: number
  attachmentCount?: number
  isReply?: boolean
  isScheduled?: boolean
}

interface EmailLogEntry {
  level: LogLevel
  action: string
  timestamp: string
  context: EmailLogContext
  duration_ms?: number
  error?: string
  error_code?: string
}

function log(level: LogLevel, action: string, context: EmailLogContext, extra?: Partial<EmailLogEntry>) {
  const entry: EmailLogEntry = {
    level,
    action,
    timestamp: new Date().toISOString(),
    context,
    ...extra,
  }

  const output = JSON.stringify(entry)

  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

/**
 * Log the start of an email send operation
 */
export function logEmailSendStart(context: EmailLogContext) {
  log('info', 'email_send_start', context)
}

/**
 * Log successful email send
 */
export function logEmailSendSuccess(context: EmailLogContext, duration_ms?: number) {
  log('info', 'email_send_success', context, { duration_ms })
}

/**
 * Log email send failure with error details
 */
export function logEmailSendError(
  context: EmailLogContext,
  error: Error | unknown,
  errorCode?: string
) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  log('error', 'email_send_error', context, {
    error: errorMessage,
    error_code: errorCode || categorizeGmailError(errorMessage),
  })
}

/**
 * Log scheduled cron job execution
 */
export function logScheduledCronStart(draftCount: number) {
  log('info', 'scheduled_cron_start', {}, {
    duration_ms: undefined,
    error: undefined,
    error_code: undefined,
  })
  console.log(JSON.stringify({
    level: 'info',
    action: 'scheduled_cron_start',
    timestamp: new Date().toISOString(),
    draft_count: draftCount,
  }))
}

/**
 * Log scheduled cron job completion
 */
export function logScheduledCronComplete(stats: {
  processed: number
  sent: number
  failed: number
  duration_ms: number
}) {
  console.log(JSON.stringify({
    level: 'info',
    action: 'scheduled_cron_complete',
    timestamp: new Date().toISOString(),
    ...stats,
  }))
}

/**
 * Log draft processing within scheduled cron
 */
export function logScheduledDraftProcessing(
  action: 'start' | 'success' | 'failed',
  context: EmailLogContext,
  error?: string
) {
  log(
    action === 'failed' ? 'error' : 'info',
    `scheduled_draft_${action}`,
    context,
    error ? { error } : undefined
  )
}

/**
 * Categorize Gmail API errors for better observability
 */
export function categorizeGmailError(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase()

  if (lowerMessage.includes('quota') || lowerMessage.includes('rate limit')) {
    return 'RATE_LIMIT'
  }
  if (lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized') || lowerMessage.includes('401')) {
    return 'AUTH_ERROR'
  }
  if (lowerMessage.includes('permission') || lowerMessage.includes('forbidden') || lowerMessage.includes('403')) {
    return 'PERMISSION_ERROR'
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return 'NOT_FOUND'
  }
  if (lowerMessage.includes('invalid') || lowerMessage.includes('malformed')) {
    return 'INVALID_REQUEST'
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'TIMEOUT'
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    return 'NETWORK_ERROR'
  }
  if (lowerMessage.includes('attachment') || lowerMessage.includes('file size')) {
    return 'ATTACHMENT_ERROR'
  }

  return 'UNKNOWN'
}
