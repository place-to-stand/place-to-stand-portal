import throttle from "lodash.throttle"

import { useUnmount } from "@/hooks/use-unmount"
import { useEffect, useMemo, useRef } from "react"

interface ThrottleSettings {
  leading?: boolean | undefined
  trailing?: boolean | undefined
}

const defaultOptions: ThrottleSettings = {
  leading: false,
  trailing: true,
}

type Throttled<T extends (...args: never[]) => unknown> = ReturnType<
  typeof throttle<T>
>

/**
 * A hook that returns a throttled callback function.
 *
 * The returned wrapper is stable across renders and always invokes the
 * latest `fn`; the underlying throttle is recreated only when `wait` or the
 * throttle options change, so callers don't need to pass a dependency list.
 *
 * @param fn The function to throttle
 * @param wait The time in ms to wait before calling the function
 * @param options The throttle options
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useThrottledCallback<T extends (...args: any[]) => any>(
  fn: T,
  wait = 250,
  options: ThrottleSettings = defaultOptions
): {
  (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T>
  cancel: () => void
  flush: () => void
} {
  const fnRef = useRef(fn)
  const throttledRef = useRef<Throttled<T> | null>(null)

  useEffect(() => {
    fnRef.current = fn
  })

  const { leading, trailing } = options
  useEffect(() => {
    throttledRef.current?.cancel()
    throttledRef.current = throttle(
      ((...args: Parameters<T>) => fnRef.current(...args)) as T,
      wait,
      { leading, trailing }
    )
  }, [wait, leading, trailing])

  useUnmount(() => {
    throttledRef.current?.cancel()
  })

  return useMemo(() => {
    const wrapper = (...args: Parameters<T>) =>
      throttledRef.current?.(...args) as ReturnType<T>
    wrapper.cancel = () => throttledRef.current?.cancel()
    wrapper.flush = () => throttledRef.current?.flush()
    return wrapper
  }, [])
}

export default useThrottledCallback
