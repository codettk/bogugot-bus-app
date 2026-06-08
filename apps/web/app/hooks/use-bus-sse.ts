'use client'

import { useState, useEffect } from 'react'
import type { BusLocation, SseEvent } from '@bogugot/types'

export function useBusSSE(routeId: string | null): BusLocation[] {
  const [buses, setBuses] = useState<BusLocation[]>([])

  useEffect(() => {
    if (!routeId) {
      setBuses([])
      return
    }

    const es = new EventSource(`/api/bus/location/${encodeURIComponent(routeId)}`)

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as SseEvent
        if (event.type === 'bus-location') {
          setBuses(event.locations)
        }
        // heartbeat / error 이벤트는 위치 갱신 대상이 아니므로 무시
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
