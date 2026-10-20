'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const schema = z.object({
  authorizationId: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
})

/**
 * Record the signed-in admin's consent decision with Supabase Auth and send
 * the browser back to the OAuth client. The admin check is repeated here
 * because a server action is its own endpoint — the page having rendered the
 * buttons proves nothing about who is posting.
 */
export async function decideAuthorization(formData: FormData) {
  const { authorizationId, decision } = schema.parse({
    authorizationId: formData.get('authorizationId'),
    decision: formData.get('decision'),
  })

  const user = await getCurrentUser()

  if (!user || user.role !== 'ADMIN') {
    redirect(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`)
  }

  const supabase = getSupabaseServerClient()
  const options = { skipBrowserRedirect: true }
  const { data, error } =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, options)
      : await supabase.auth.oauth.denyAuthorization(authorizationId, options)

  if (error || !data?.redirect_url) {
    console.error('Unable to record OAuth consent decision', {
      decision,
      error,
    })
    redirect(
      `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}&error=decision`
    )
  }

  redirect(data.redirect_url)
}
