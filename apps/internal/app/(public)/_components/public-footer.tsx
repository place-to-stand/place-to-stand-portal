const SITE_URL = 'https://placetostandagency.com'

/** The marketing site's bottom bar: copyright left, the site right. */
export function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className='border-brand-border bg-brand-bg-card mt-16 border-t sm:mt-[72px]'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-12'>
        <span className='text-brand-text-muted text-[11px] tracking-[0.1em] uppercase sm:text-xs'>
          © {year} Place To Stand. All rights reserved.
        </span>
        <a
          href={SITE_URL}
          className='text-brand-text-muted hover:text-brand-lime font-mono text-[10px] tracking-[0.1em] uppercase transition-colors sm:text-[11px]'
        >
          placetostandagency.com
        </a>
      </div>
    </footer>
  )
}
