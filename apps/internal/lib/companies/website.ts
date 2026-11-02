/** A stored website as a link target; older rows may lack the scheme. */
export function toWebsiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}
