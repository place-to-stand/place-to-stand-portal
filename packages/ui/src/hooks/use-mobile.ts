'use client'

import { useEffect, useState } from 'react'

export function useIsMobile(breakpoint = 768) {
  // Initialize undefined on server AND first client render — reading
  // window.innerWidth in the initializer makes the first client render
  // diverge from SSR and fails hydration for the whole tree on narrow
  // viewports. The real value lands in the effect, after hydration.
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener('change', onChange)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the width is only known after hydration (see above)
    setIsMobile(window.innerWidth < breakpoint)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return !!isMobile
}
