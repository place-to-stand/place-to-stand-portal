'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'

import { isValidTimeZone } from '@pts/db/business'
import { businessSettings, companies } from '@pts/db/schema'

import { businessSettingsUpdatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requirePage } from '@/lib/auth/session'
import { clearBusinessIdentityMemo } from '@/lib/business/identity'
import { validateImageDataUrl } from '@/lib/business/images'
import { checkSendingAddress } from '@/lib/business/sending-domain'
import {
  BUSINESS_FIELD_LABELS,
  businessSettingsSchema,
  type BusinessImageChange,
  type BusinessSettingsInput,
  type BusinessSettingsValues,
} from '@/lib/business/settings-form'
import { db } from '@/lib/db'

type SaveBusinessSettingsResult =
  | { ok: true }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof BusinessSettingsValues, string>>
    }

type TextField = keyof typeof BUSINESS_FIELD_LABELS

/**
 * Saves the Business page in one transaction: the name onto the staff company
 * (creating it on an install that has none), everything else onto the one
 * business_settings row, and marks the settings confirmed so the setup banner
 * goes away.
 */
export async function saveBusinessSettings(
  input: BusinessSettingsInput
): Promise<SaveBusinessSettingsResult> {
  const user = await requirePage('settings.business')

  const parsed = businessSettingsSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof BusinessSettingsValues, string>> =
      {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof BusinessSettingsValues
      fieldErrors[key] ??= issue.message
    }
    return { ok: false, error: 'Check the highlighted fields.', fieldErrors }
  }
  const values = parsed.data

  if (
    !isValidTimeZone(values.timeZone) ||
    !(await databaseKnowsTimeZone(values.timeZone))
  ) {
    return {
      ok: false,
      error: 'Check the highlighted fields.',
      fieldErrors: { timeZone: 'Pick a time zone from the list.' },
    }
  }

  for (const kind of ['logo', 'icon'] as const) {
    const change = values[kind]
    if (change.kind !== 'replace') continue
    const problem = validateImageDataUrl(change.dataUrl)
    if (problem) {
      return {
        ok: false,
        error: 'Check the highlighted fields.',
        fieldErrors: { [kind]: problem },
      }
    }
  }

  const before = await readCurrent()

  if (values.sendingEmail && values.sendingEmail !== before.sendingEmail) {
    const problem = await checkSendingAddress(values.sendingEmail)
    if (problem) {
      return {
        ok: false,
        error: 'Check the highlighted fields.',
        fieldErrors: { sendingEmail: problem },
      }
    }
  }

  const textValues = Object.fromEntries(
    (Object.keys(BUSINESS_FIELD_LABELS) as TextField[]).map(key => [
      key,
      values[key],
    ])
  ) as Record<TextField, string | null>

  await db.transaction(async tx => {
    if (before.staffCompanyId) {
      await tx
        .update(companies)
        .set({ name: values.name, updatedAt: sql`now()` })
        .where(eq(companies.id, before.staffCompanyId))
    } else {
      await tx.insert(companies).values({
        name: values.name,
        isStaff: true,
        createdBy: user.id,
      })
    }

    const row = {
      legalName: values.legalName,
      website: values.website,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      city: values.city,
      region: values.region,
      postalCode: values.postalCode,
      country: values.country,
      phone: values.phone,
      inboxEmail: values.inboxEmail,
      sendingEmail: values.sendingEmail,
      bookingUrl: values.bookingUrl,
      timeZone: values.timeZone,
      ...imageColumn('logoDataUrl', values.logo),
      ...imageColumn('iconDataUrl', values.icon),
      confirmedAt: sql`coalesce(${businessSettings.confirmedAt}, now())`,
      updatedBy: user.id,
      updatedAt: sql`now()`,
    }

    await tx
      .insert(businessSettings)
      .values({ id: true, ...row, confirmedAt: sql`now()` })
      .onConflictDoUpdate({ target: businessSettings.id, set: row })
  })

  const changedFields = (Object.keys(BUSINESS_FIELD_LABELS) as TextField[])
    .filter(key => (before.values[key] ?? null) !== textValues[key])
    .map(key => BUSINESS_FIELD_LABELS[key])
  if (values.logo.kind !== 'keep') changedFields.push('logo')
  if (values.icon.kind !== 'keep') changedFields.push('icon')

  const event = businessSettingsUpdatedEvent({
    changedFields,
    details: {
      before: before.values,
      after: textValues,
    },
  })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'SETTINGS',
    targetId: null,
    metadata: event.metadata,
  })

  clearBusinessIdentityMemo()
  // Every page shows the name, logo or dates, so refresh them all.
  revalidatePath('/', 'layout')
  return { ok: true }
}

function imageColumn(
  column: 'logoDataUrl' | 'iconDataUrl',
  change: BusinessImageChange
) {
  if (change.kind === 'keep') return {}
  return { [column]: change.kind === 'replace' ? change.dataUrl : null }
}

async function readCurrent() {
  const [[staff], [settings]] = await Promise.all([
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      // Archived or not, as findStaffCompany does: there is only ever one
      // (uq_companies_staff), so inserting another would fail.
      .where(eq(companies.isStaff, true))
      .orderBy(sql`${companies.deletedAt} is not null`)
      .limit(1),
    db
      .select({
        legalName: businessSettings.legalName,
        website: businessSettings.website,
        addressLine1: businessSettings.addressLine1,
        addressLine2: businessSettings.addressLine2,
        city: businessSettings.city,
        region: businessSettings.region,
        postalCode: businessSettings.postalCode,
        country: businessSettings.country,
        phone: businessSettings.phone,
        inboxEmail: businessSettings.inboxEmail,
        sendingEmail: businessSettings.sendingEmail,
        bookingUrl: businessSettings.bookingUrl,
        timeZone: businessSettings.timeZone,
      })
      .from(businessSettings)
      .limit(1),
  ])

  const values: Record<TextField, string | null> = {
    name: staff?.name ?? null,
    legalName: settings?.legalName ?? null,
    website: settings?.website ?? null,
    addressLine1: settings?.addressLine1 ?? null,
    addressLine2: settings?.addressLine2 ?? null,
    city: settings?.city ?? null,
    region: settings?.region ?? null,
    postalCode: settings?.postalCode ?? null,
    country: settings?.country ?? null,
    phone: settings?.phone ?? null,
    inboxEmail: settings?.inboxEmail ?? null,
    sendingEmail: settings?.sendingEmail ?? null,
    bookingUrl: settings?.bookingUrl ?? null,
    timeZone: settings?.timeZone ?? null,
  }

  return {
    staffCompanyId: staff?.id ?? null,
    sendingEmail: values.sendingEmail,
    values,
  }
}

/**
 * Postgres's time zone list can differ from the runtime's, and the zone is
 * also used in SQL (time-log month totals), so both must know it.
 */
async function databaseKnowsTimeZone(timeZone: string): Promise<boolean> {
  try {
    await db.execute(sql`select now() at time zone ${timeZone}`)
    return true
  } catch {
    return false
  }
}
