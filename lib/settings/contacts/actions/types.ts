import type { AppUser } from '@/lib/auth/session'
import type { ContactActionResult } from '@/lib/settings/contacts/contact-service'

export type ContactMutationContext = {
  user: AppUser
}

export type ContactMutationResult = ContactActionResult & {
  didMutate: boolean
}

export function buildMutationResult(
  result: ContactActionResult
): ContactMutationResult {
  return {
    ...result,
    didMutate: !result.error,
  }
}
