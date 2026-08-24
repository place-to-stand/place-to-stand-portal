/**
 * Shared by the server action, page, and client selector — kept out of
 * session-overview.ts because a `'use server'` file may only export async
 * functions, not plain constants.
 */
export const ALL_SESSIONS_OWNER = 'all'
