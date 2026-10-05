import type { DbClient } from '@/lib/types'

import type { ClientCloser } from './closers'

/** The client sheet's row: the snake_case client plus its saved closer split. */
export type ClientRow = DbClient & { closers: ClientCloser[] }
