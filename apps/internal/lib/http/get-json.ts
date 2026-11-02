/**
 * Reads one of our `{ ok, data }` GET routes from the browser. Sheets and
 * pickers load through these instead of server actions: Next runs server
 * actions one at a time per tab, so reads queued behind each other (and
 * behind any save), while GETs run side by side.
 */
export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  const body = (await response.json().catch(() => null)) as
    { ok: true; data: T } | { ok: false; error?: string } | null

  if (!response.ok || !body?.ok) {
    throw new Error(
      (body && !body.ok && body.error) || `Request failed (${response.status})`
    )
  }

  return body.data
}
