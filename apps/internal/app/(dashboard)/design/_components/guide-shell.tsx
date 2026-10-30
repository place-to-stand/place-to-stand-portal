'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { DESIGN_SECTION_GROUPS } from './sections'
import { ThemeToggle } from './theme-toggle'

const ALL_SECTIONS: ReadonlyArray<{ id: string; label: string }> =
  DESIGN_SECTION_GROUPS.flatMap(
    group => group.sections as ReadonlyArray<{ id: string; label: string }>
  )

/**
 * The style guide's frame: a page header with the theme switch, a sticky
 * index of sections on the left (a scrolling chip row on phones) that
 * follows the scroll, and the sections themselves.
 */
export function GuideShell({ children }: { children: ReactNode }) {
  const active = useActiveSection()

  return (
    <div className='mx-auto w-full max-w-[1400px] px-1 pb-24 sm:px-2'>
      <header className='flex flex-col gap-5 pt-4 pb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-8'>
        <div className='max-w-2xl space-y-3'>
          <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
            Design system
          </h1>
          <p className='text-muted-foreground text-base leading-relaxed'>
            The living reference for how the portal looks, reads and behaves.
            Every example below is the real component, so this page can&apos;t
            drift from the app. Switch the theme to check both.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* Phones and tablets: a sticky row of section chips. */}
      <nav
        aria-label='Sections'
        className='bg-background/90 sticky top-0 z-20 -mx-3 mb-8 flex gap-1 overflow-x-auto border-y px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4 lg:hidden'
      >
        {ALL_SECTIONS.map(section => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={event => jumpTo(event, section.id)}
            aria-current={active === section.id ? 'true' : undefined}
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1 text-sm whitespace-nowrap transition-colors',
              active === section.id
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className='grid grid-cols-1 gap-12 lg:grid-cols-[13rem_minmax(0,1fr)] xl:gap-16'>
        <aside className='hidden lg:block'>
          <nav
            aria-label='Sections'
            className='sticky top-0 max-h-[calc(100dvh-5rem)] space-y-6 overflow-y-auto pt-1 pb-6'
          >
            {DESIGN_SECTION_GROUPS.map(group => (
              <div key={group.title} className='space-y-1.5'>
                <p className='text-muted-foreground px-3 text-[11px] font-semibold tracking-wider uppercase'>
                  {group.title}
                </p>
                <ul className='border-l'>
                  {group.sections.map(section => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={event => jumpTo(event, section.id)}
                        aria-current={
                          active === section.id ? 'true' : undefined
                        }
                        className={cn(
                          '-ml-px block border-l-2 py-1 pr-2 pl-3 text-sm transition-colors',
                          active === section.id
                            ? 'border-foreground text-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground border-transparent'
                        )}
                      >
                        {section.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <div className='min-w-0 space-y-16'>{children}</div>
      </div>
    </div>
  )
}

/**
 * Scrolls PageShell's content pane to a section. A plain #anchor would also
 * scroll the overflow-hidden <html> and shift the whole app shell up.
 */
function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id)
  const pane = target?.closest('main')
  if (!target || !pane) return
  event.preventDefault()
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
  pane.scrollTo({
    top:
      target.getBoundingClientRect().top -
      pane.getBoundingClientRect().top +
      pane.scrollTop -
      16,
    behavior: reduceMotion ? 'auto' : 'smooth',
  })
  window.history.replaceState(null, '', `#${id}`)
}

/**
 * Scroll-spy: the last section whose top has scrolled above the upper third
 * of the viewport (or the last one, at the very bottom). Listens on
 * PageShell's scroll pane, the <main> that holds the sections.
 */
function useActiveSection() {
  const [active, setActive] = useState<string>(ALL_SECTIONS[0].id)

  useEffect(() => {
    const first = document.getElementById(ALL_SECTIONS[0].id)
    const pane = first?.closest('main')
    if (!pane) return
    let frame = 0

    const update = () => {
      frame = 0
      const line = pane.getBoundingClientRect().top + pane.clientHeight / 3
      const atBottom =
        pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2
      let current = ALL_SECTIONS[0].id
      for (const section of ALL_SECTIONS) {
        const element = document.getElementById(section.id)
        if (element && element.getBoundingClientRect().top <= line) {
          current = section.id
        }
      }
      setActive(atBottom ? ALL_SECTIONS[ALL_SECTIONS.length - 1].id : current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    pane.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      pane.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return active
}
