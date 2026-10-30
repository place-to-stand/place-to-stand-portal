// Kept identical in apps/internal and apps/client (lib/auth/safe-redirect.ts).

/**
 * True for a same-origin relative path: starts with one `/`, not `//` or
 * `/\` (browsers treat a backslash as a slash, so `/\evil.com` is
 * protocol-relative), and has no control characters (a tab or newline is
 * stripped by URL parsing and can rebuild either prefix).
 */
export function isSafeRedirectPath(value: string): boolean {
  if (!value.startsWith('/')) return false
  if (/^\/[/\\]/.test(value)) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return false
  return true
}

/** `value` when it is a safe relative path (`isSafeRedirectPath`), else '/'. */
export function safeRedirectPath(value: string | null | undefined): string {
  return value && isSafeRedirectPath(value) ? value : '/'
}
