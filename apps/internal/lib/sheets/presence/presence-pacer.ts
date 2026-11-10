/**
 * Realtime closes a channel whose client sends more than 5 presence
 * updates in 30 seconds (ClientPresenceRateLimitReached), so a few quick
 * edit-and-save rounds would drop the person from everyone's alert. The
 * pacer sends at most one update per `gapMs`: a change inside the gap
 * waits, and only the latest state goes out when it ends (nothing, when
 * it is back to what was last sent).
 */
export const PRESENCE_GAP_MS = 8000

type Timers = {
  now: () => number
  setTimeout: (run: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const realTimers: Timers = {
  now: () => Date.now(),
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: handle =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function createPresencePacer<T>(
  send: (state: T) => void,
  same: (a: T, b: T) => boolean,
  gapMs = PRESENCE_GAP_MS,
  timers: Timers = realTimers
) {
  let lastSentAt = -Infinity
  let lastSent: { state: T } | null = null
  let pending: { state: T } | null = null
  let timer: unknown = null

  const flush = () => {
    timer = null
    if (!pending) return
    const { state } = pending
    pending = null
    if (lastSent && same(lastSent.state, state)) return
    lastSent = { state }
    lastSentAt = timers.now()
    send(state)
  }

  return {
    /** Send now if the gap has passed, else once it has. */
    update(state: T) {
      pending = { state }
      if (timer !== null) return
      const wait = lastSentAt + gapMs - timers.now()
      if (wait <= 0) flush()
      else timer = timers.setTimeout(flush, wait)
    },
    /**
     * A fresh channel: the server holds nothing for this client, so the
     * next update goes straight out. The join's own update counts as a
     * send, so the gap starts from it.
     */
    joined(state: T) {
      if (timer !== null) timers.clearTimeout(timer)
      timer = null
      pending = null
      lastSent = { state }
      lastSentAt = timers.now()
      send(state)
    },
    stop() {
      if (timer !== null) timers.clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}
