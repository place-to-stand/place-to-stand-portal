import { z } from 'zod'

import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_SHORT,
  PASSWORDS_DIFFER,
} from '@pts/ui/auth-shell'

/** A new password: the one rule both portals apply. Client-safe. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT)

/** A new password typed twice. */
export const newPasswordPairSchema = z
  .object({ password: passwordSchema, confirmPassword: passwordSchema })
  .refine(values => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: PASSWORDS_DIFFER,
  })
