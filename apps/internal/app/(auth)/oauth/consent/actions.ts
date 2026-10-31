'use server'
// permission: public — checks the signed-in user itself

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { canUseInternalPortal } from '@/lib/auth/roles'
import { getCurrentUser } from '@/lib/auth/session'
import { isAllowedRedirect } from '@/lib/mcp/redirects'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const schema = z.object({
  authorizationId: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
})

/**
 * Record the signed-in staff user's consent decision with Supabase Auth and send
 * the browser back to the OAuth client. The role and redirect checks are
 * repeated here because a server action is its own endpoint — the page
 * having rendered the buttons proves nothing about who is posting or where
 * the code will go.
 */
export async function decideAuthorization(formData: FormData) {
  const { authorizationId, decision } = schema.parse({
    authorizationId: formData.get('authorizationId'),
    decision: formData.get('decision'),
  })

  const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
  const user = await getCurrentUser()

  if (!user || !canUseInternalPortal(user.role)) {
    redirect(back)
  }

  const supabase = getSupabaseServerClient()

  if (decision === 'approve') {
    const { data: details } =
      await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

    if (
      !details ||
      !('authorization_id' in details) ||
      !isAllowedRedirect(details.redirect_uri)
    ) {
      redirect(back)
    }
  }

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
    redirect(`${back}&error=decision`)
  }

  redirect(data.redirect_url)
}
