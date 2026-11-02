/**
 * Which section a sheet should scroll to when it opens (a lead's Won lands
 * on the company's billing), handed over in memory instead of a `tab=` URL
 * param: sheets have no tabs, and the link stays clean. Set it right before
 * opening the sheet; the sheet reads it while open and clears it on close.
 */
export type CompanySheetSection = 'people' | 'billing' | 'projects'

const targets = new Map<string, CompanySheetSection>()

const keyOf = (entity: 'company', id: string) => `${entity}:${id}`

export function setSheetSectionTarget(
  entity: 'company',
  id: string,
  section: CompanySheetSection
) {
  targets.set(keyOf(entity, id), section)
}

export function peekSheetSectionTarget(
  entity: 'company',
  id: string
): CompanySheetSection | null {
  return targets.get(keyOf(entity, id)) ?? null
}

export function clearSheetSectionTarget(entity: 'company', id: string) {
  targets.delete(keyOf(entity, id))
}
