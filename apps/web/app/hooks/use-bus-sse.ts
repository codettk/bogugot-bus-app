'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { BusLocation, SseEvent } from '@bogugot/types'

export type BusSseStatus = 'idle' | 'connecting' | 'open' | 'error'

export interface UseBusSSEResult {
  locations: BusLocation[]
  status: BusSseStatus
}

const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

export function useBusSSE(routeId: string | null): UseBusSSEResult {
  const [locations, setLocations] = useState<BusLocation[]>([])
  const [status, setStatus] = useState<BusSseStatus>('idle')

  // 활성 EventSource 와 재연결 타이머/백오프 값을 렌더 사이에 유지한다.
  const esRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffRef = useRef<number>(INITIAL_BACKOFF_MS)

  // 진행 중인 EventSource 와 예약된 재연결 타이머를 모두 정리한다.
  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (esRef.current !== null) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!routeId) {
      cleanup()
      setLocations([])
      setStatus('idle')
      return
    }

    backoffRef.current = INITIAL_BACKOFF_MS

    const connect = () => {
      // 새 연결 전 기존 연결/타이머 정리 (유령 연결 방지)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (esRef.current !== null) {
        esRef.current.close()
        esRef.current = null
      }

      setStatus('connecting')

      const es = new EventSource(`/api/bus/location/${encodeURIComponent(routeId)}`)
      esRef.current = es

      es.onopen = () => {
        // 정상 연결 시 백오프 카운터 리셋
        backoffRef.current = INITIAL_BACKOFF_MS
        setStatus('open')
      }

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          const event = JSON.parse(e.data) as SseEvent
          if (event.type === 'bus-location') {
            setLocations(event.locations)
          }
          // heartbeat / bus-arrival 이벤트는 위치 갱신 대상이 아니므로 무시
          // error 이벤트는 onerror 흐름으로 처리되므로 별도 갱신 없음
        } catch {
          // 파싱 실패 시 무시 (잘못된 페이로드)
        }
      }

      es.onerror = () => {
        setStatus('error')
        es.close()
        if (esRef.current === es) {
          esRef.current = null
        }
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      const delay = backoffRef.current
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        connect()
      }, delay)
      // 다음 실패를 위해 지수 증가 (상한 적용)
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
    }

    connect()

    return () => {
      cleanup()
    }
  }, [routeId, cleanup])

  return { locations, status }
}
