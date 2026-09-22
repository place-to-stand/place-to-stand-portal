/**
 * Delivery timing shared by the sender, the retry sweep and the UI. No
 * `server-only` here: the submission sheet reads the window to describe a
 * null stamp honestly.
 */

/** How long a send may hold its lease before another attempt may take it. */
export const EMAIL_LEASE_MINUTES = 10

/** The sweep leaves a fresh request alone so it never races the intake route. */
export const RETRY_MIN_AGE_MINUTES = 5

/**
 * After this an unsent email is no longer retried. A lead notification three
 * days late is not worth sending, and the row has been flagging unread in the
 * portal the whole time; the sheet says so instead of "queued".
 */
export const RETRY_MAX_AGE_HOURS = 72

/**
 * How often the sweep runs. Must match the `retry-submission-emails` schedule
 * in apps/internal/vercel.json; the stuck-email alert uses it as the window
 * in which a row "just crossed" the alert threshold, so each row alerts once.
 */
export const SWEEP_INTERVAL_MINUTES = 15

/** An email still unsent this long after it was requested pings the team. */
export const STUCK_ALERT_AFTER_MINUTES = 60
