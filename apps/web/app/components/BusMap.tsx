'use client'

import { useEffect, useRef } from 'react'
import { useBusSSE } from '@/app/hooks/use-bus-sse'

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY
const KAKAO_SDK_ID = 'kakao-maps-sdk'

// 경기도청 기본 중심 좌표 (routeId 미선택 시 초기 위치)
const DEFAULT_CENTER = { lat: 37.2752, lng: 127.0096 }

interface BusMapProps {
  routeId: string | null
}

function loadKakaoSdk(): Promise<KakaoNamespace> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('window is not available'))
      return
    }
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao as KakaoNamespace))
      return
    }
    if (!KAKAO_APP_KEY) {
      reject(new Error('NEXT_PUBLIC_KAKAO_MAP_APP_KEY 가 설정되지 않았습니다.'))
      return
    }

    const existing = document.getElementById(KAKAO_SDK_ID) as HTMLScriptElement | null
    const onReady = () => {
      window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace))
    }

    if (existing) {
      existing.addEventListener('load', onReady, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = KAKAO_SDK_ID
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`
    script.addEventListener('load', onReady, { once: true })
    script.addEventListener('error', () => reject(new Error('Kakao Maps SDK 로드 실패')), {
      once: true,
    })
    document.head.appendChild(script)
  })
}

export function BusMap({ routeId }: BusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const kakaoRef = useRef<KakaoNamespace | null>(null)
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map())

  const { locations: buses } = useBusSSE(routeId)

  // 지도 초기화
  useEffect(() => {
    let cancelled = false

    loadKakaoSdk()
      .then((kakao) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        kakaoRef.current = kakao
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          level: 5,
        })
      })
      .catch(() => {
        // SDK 로드 실패 시 빈 컨테이너 유지 (UI 안내는 추후 처리)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // 버스 위치 → 마커 동기화
  useEffect(() => {
    const kakao = kakaoRef.current
    const map = mapRef.current
    if (!kakao || !map) return

    const markers = markersRef.current
    const seen = new Set<string>()

    for (const bus of buses) {
      seen.add(bus.busId)
      const position = new kakao.maps.LatLng(bus.latitude, bus.longitude)
      const existing = markers.get(bus.busId)
      if (existing) {
        existing.setPosition(position)
      } else {
        const marker = new kakao.maps.Marker({
          position,
          map,
          title: bus.plateNo,
        })
        markers.set(bus.busId, marker)
      }
    }

    // 더 이상 보이지 않는 버스 마커 제거
    for (const [busId, marker] of markers) {
      if (!seen.has(busId)) {
        marker.setMap(null)
        markers.delete(busId)
      }
    }

    // 첫 버스 위치로 지도 중심 이동
    const first = buses[0]
    if (first) {
      map.setCenter(new kakao.maps.LatLng(first.latitude, first.longitude))
    }
  }, [buses])

  return <div ref={containerRef} className="h-full w-full" aria-label="실시간 버스 지도" />
}
