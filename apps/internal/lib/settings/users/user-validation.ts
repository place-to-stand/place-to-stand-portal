import { z } from 'zod'

// SALES: CRM staff (leads and contacts only). See lib/auth/roles.ts.
export const USER_ROLES = ['ADMIN', 'SALES', 'CLIENT'] as const

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(USER_ROLES),
})

export const deleteUserSchema = z.object({
  id: z.string().uuid(),
})

export const setUserDisabledSchema = z.object({
  id: z.string().uuid(),
  disabled: z.boolean(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type DeleteUserInput = z.infer<typeof deleteUserSchema>
export type SetUserDisabledInput = z.infer<typeof setUserDisabledSchema>
