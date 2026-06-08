'use client'

import { useEffect, useRef, useState } from 'react'
import type { BusLocation } from '@bogugot/types'
import { useBusSSE } from '../hooks/use-bus-sse'

// Kakao Maps SDK 최소 타입 정의 (any 금지 — 사용하는 부분만 선언)
interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void
  setBounds(bounds: KakaoLatLngBounds): void
}

interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void
  isEmpty(): boolean
}

interface KakaoMarker {
  setMap(map: KakaoMap | null): void
  setPosition(latlng: KakaoLatLng): void
  setTitle(title: string): void
}

interface KakaoMaps {
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap
  Marker: new (options: { position: KakaoLatLng; title?: string }) => KakaoMarker
  load(callback: () => void): void
}

interface KakaoNamespace {
  maps: KakaoMaps
}

declare global {
  interface Window {
    kakao?: KakaoNamespace
  }
}

const SDK_SCRIPT_ID = 'kakao-maps-sdk'
// 경기도청 (수원) — 초기 중심점
const DEFAULT_CENTER = { lat: 37.2752, lng: 127.0096 }
const DEFAULT_LEVEL = 6

function loadKakaoSdk(appKey: string): Promise<KakaoNamespace> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao as KakaoNamespace))
      return
    }

    const existing = document.getElementById(SDK_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => {
        window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace))
      })
      existing.addEventListener('error', () => reject(new Error('카카오맵 SDK 로드에 실패했습니다')))
      return
    }

    const script = document.createElement('script')
    script.id = SDK_SCRIPT_ID
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.addEventListener('load', () => {
      window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace))
    })
    script.addEventListener('error', () => reject(new Error('카카오맵 SDK 로드에 실패했습니다')))
    document.head.appendChild(script)
  })
}

interface BusMapProps {
  routeId: string | null
}

export function BusMap({ routeId }: BusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const kakaoRef = useRef<KakaoNamespace | null>(null)
  // busId -> Marker 매핑으로 마커 재사용 (매 틱마다 재생성 방지)
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map())

  const [loadError, setLoadError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const buses: BusLocation[] = useBusSSE(routeId)

  // SDK 로드 + 지도 초기화
  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY
    if (!appKey) {
      setLoadError('카카오맵 앱 키가 설정되지 않았습니다 (NEXT_PUBLIC_KAKAO_MAP_APP_KEY)')
      return
    }

    let cancelled = false

    loadKakaoSdk(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return
        kakaoRef.current = kakao
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          level: DEFAULT_LEVEL,
        })
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : '지도를 불러오지 못했습니다')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // 노선 변경 시 기존 마커 정리
  useEffect(() => {
    const markers = markersRef.current
    markers.forEach((marker) => marker.setMap(null))
    markers.clear()
  }, [routeId])

  // 버스 위치 갱신 시 마커 동기화
  useEffect(() => {
    const kakao = kakaoRef.current
    const map = mapRef.current
    if (!ready || !kakao || !map) return

    const markers = markersRef.current
    const liveIds = new Set(buses.map((bus) => bus.busId))

    // 사라진 버스 마커 제거
    markers.forEach((marker, busId) => {
      if (!liveIds.has(busId)) {
        marker.setMap(null)
        markers.delete(busId)
      }
    })

    // 현재 버스 마커 추가/이동
    const bounds = new kakao.maps.LatLngBounds()
    for (const bus of buses) {
      const position = new kakao.maps.LatLng(bus.latitude, bus.longitude)
      const title = `${bus.plateNo} (잔여 ${bus.remainSeatCnt}석)`
      const existing = markers.get(bus.busId)
      if (existing) {
        existing.setPosition(position)
        existing.setTitle(title)
      } else {
        const marker = new kakao.maps.Marker({ position, title })
        marker.setMap(map)
        markers.set(bus.busId, marker)
      }
      bounds.extend(position)
    }

    if (!bounds.isEmpty()) {
      map.setBounds(bounds)
    }
  }, [buses, ready])

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 p-4 text-center text-sm text-red-600">
        {loadError}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-50/70 text-sm text-gray-500">
          지도를 불러오는 중…
        </div>
      )}
    </div>
  )
}
