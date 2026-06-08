'use client'

import { useEffect, useState } from 'react'

/**
 * 입력값을 지정한 지연(ms) 이후에만 갱신하는 디바운스 훅.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
