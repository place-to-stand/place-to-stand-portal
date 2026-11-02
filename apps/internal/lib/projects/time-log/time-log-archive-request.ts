/**
 * Archive (soft delete) or restore one time log through
 * `/api/projects/[projectId]/time-logs/[timeLogId]`. Resolves with the
 * closed-month warning that rides the response (PRD 002 section 05), or
 * throws with the API's error message.
 */
export async function requestTimeLogArchiveChange(
  projectId: string,
  timeLogId: string,
  change: 'archive' | 'restore'
): Promise<{ warning: string | null }> {
  const response = await fetch(
    `/api/projects/${projectId}/time-logs/${timeLogId}`,
    change === 'archive'
      ? { method: 'DELETE' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        }
  )

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: unknown }).error ?? '').trim()
        : ''

    throw new Error(
      message ||
        (change === 'archive'
          ? 'Unable to archive time log.'
          : 'Unable to restore time log.')
    )
  }

  const warning =
    typeof payload === 'object' && payload && 'warning' in payload
      ? String((payload as { warning?: unknown }).warning ?? '').trim()
      : ''

  return { warning: warning || null }
}
