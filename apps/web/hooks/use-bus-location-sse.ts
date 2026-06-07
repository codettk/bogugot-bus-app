// 이 파일은 'use client' 전용 훅입니다. Server Component에서 import하지 마세요.
import { useState, useEffect, useRef, useCallback } from 'react'
import type { BusLocation, BusLocationEvent } from '@bogugot/types'
import { useBusStore } from '../store/bus-store'

const MAX_RETRY = 3
const RETRY_DELAY_MS = 5_000

interface UseBusLocationSseResult {
  locations: BusLocation[]
  connected: boolean
  error: string | null
}

export function useBusLocationSse(routeId: string | null): UseBusLocationSseResult {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const updateLocations = useBusStore((state) => state.updateLocations)
  const busLocations = useBusStore((state) => state.busLocations)

  const locations = routeId != null ? (busLocations.get(routeId) ?? []) : []

  const connect = useCallback(() => {
    if (routeId == null) return

    const es = new EventSource(`/api/bus/location/${routeId}`)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      setError(null)
      retryCountRef.current = 0
    }

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as BusLocationEvent
        updateLocations(data.routeId, data.locations)
      } catch {
        // 파싱 실패 시 무시 (연결 유지)
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      setConnected(false)

      if (retryCountRef.current < MAX_RETRY) {
        retryCountRef.current += 1
        setError(`연결이 끊겼습니다. 재시도 중... (${retryCountRef.current}/${MAX_RETRY})`)
        retryTimerRef.current = setTimeout(() => {
          connect()
        }, RETRY_DELAY_MS)
      } else {
        setError('SSE 연결에 실패했습니다. 페이지를 새로고침해 주세요.')
      }
    }
  }, [routeId, updateLocations])

  useEffect(() => {
    if (routeId == null) {
      setConnected(false)
      setError(null)
      return
    }

    retryCountRef.current = 0
    connect()

    return () => {
      if (retryTimerRef.current != null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      if (esRef.current != null) {
        esRef.current.close()
        esRef.current = null
      }
      setConnected(false)
    }
  }, [routeId, connect])

  return { locations, connected, error }
}
