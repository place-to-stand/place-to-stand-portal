/** "https://www.acme.com/about" → "acme.com", for showing a website compactly. */
export function displayWebsiteHost(website: string | null | undefined) {
  if (!website) return null
  try {
    return new URL(toWebsiteHref(website)).hostname.replace(/^www\./, '')
  } catch {
    return website
  }
}

/** A stored website as a link target; older rows may lack the scheme. */
export function toWebsiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}
