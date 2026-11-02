import type { ClientCompanyView } from '@/lib/types'

import type { ClientCloser } from './closers'

/** The billing form's row: the snake_case client plus its saved closer split. */
export type ClientWithClosers = ClientCompanyView & { closers: ClientCloser[] }
