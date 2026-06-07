'use client'

import { useState, useEffect } from 'react'
import type { BusLocation } from '@bogugot/types'

export function useBusSSE(routeId: string | null): BusLocation[] {
  const [buses, setBuses] = useState<BusLocation[]>([])

  useEffect(() => {
    if (!routeId) {
      setBuses([])
      return
    }

    const es = new EventSource(`/api/bus/sse?routeId=${encodeURIComponent(routeId)}`)

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as BusLocation[]
        setBuses(data)
      } catch {
        // 파싱 실패 시 무시
      }
    }

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
    }
  }, [routeId])

  return buses
}
