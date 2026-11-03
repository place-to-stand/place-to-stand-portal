import 'server-only'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/** Inputs and refresh shared by the company and person tools. */
export const companyId = z.guid().describe('Company UUID.')
export const personId = z.guid().describe('Person (contact) UUID.')

export const richText = z
  .string()
  .max(20_000)
  .describe(
    'Plain text or minimal markdown: paragraphs, - bullets, 1. lists, **bold**, *italic*, `code`, [links](https://…).'
  )

/** Web address; a bare domain ("acme.com") is fine. */
export const webAddress = z.string().trim().max(255)

/** The routes that list companies and people, as the sheets refresh them. */
const DIRECTORY_ROUTES = ['/companies', '/people', '/leads']

export function revalidateDirectory() {
  for (const path of DIRECTORY_ROUTES) revalidatePath(path)
}
