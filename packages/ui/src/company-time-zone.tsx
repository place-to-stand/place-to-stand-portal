'use client'

import { setCompanyTimeZone } from './dates'

/**
 * Hands the business time zone (Settings → Business) to the browser's date
 * formatters. It sets it while rendering, not in an effect, so it is in place
 * before the components after it format their first date; the server set the
 * same zone, so both render the same text.
 */
export function CompanyTimeZone({ timeZone }: { timeZone: string }) {
  setCompanyTimeZone(timeZone)
  return null
}
