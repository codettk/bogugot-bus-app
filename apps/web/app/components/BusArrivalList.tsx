'use client'

import type { BusArrival } from '@bogugot/types'
import { LoadingSpinner, ErrorMessage } from '@bogugot/ui'
import { useBusArrival } from '../hooks/use-bus-arrival'

// 부모가 stationId 를 주지 않는 사용처를 위한 fallback 패턴(선택):
//   import { useSelectedStationStore } from '../store/selected-station-store'
//   const selected = useSelectedStationStore((s) => s.selectedStation)
//   const effectiveStationId = stationId ?? selected?.stationId ?? null
// 기본 동작은 prop(stationId) 우선이므로 아래 구현은 prop 만 사용한다.

interface BusArrivalListProps {
  stationId: string | null // 정류장 미선택 시 null 허용
}

/**
 * crowded 코드값 → 라벨 매핑.
 * bus.ts 주석 기준: 0=정보없음, 1=여유, 2=보통, 3=혼잡.
 * 0/undefined/그 외는 표기하지 않음(null 반환).
 */
function crowdedLabel(crowded: number | undefined): string | null {
  switch (crowded) {
    case 1:
      return '여유'
    case 2:
      return '보통'
    case 3:
      return '혼잡'
    default:
      return null
  }
}

/** predictTime(분) → 사람이 읽는 도착 문구. 0 이하이면 '곧 도착'. */
function predictLabel(minutes: number): string {
  return minutes > 0 ? `약 ${minutes}분` : '곧 도착'
}

interface ArrivalLeg {
  predictTime: number
  locationNo: number | undefined
  crowded: number | undefined
}

function ArrivalLegInfo({ leg, primary }: { leg: ArrivalLeg; primary: boolean }) {
  const crowd = crowdedLabel(leg.crowded)
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={primary ? 'font-semibold text-blue-700' : 'text-gray-600'}>
        {primary ? predictLabel(leg.predictTime) : `다음 차: ${predictLabel(leg.predictTime)}`}
      </span>
      {leg.locationNo !== undefined && (
        <span className="text-xs text-gray-500">{leg.locationNo}번째 전</span>
      )}
      {crowd !== null && (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{crowd}</span>
      )}
    </div>
  )
}

function ArrivalItem({ arrival }: { arrival: BusArrival }) {
  const showSecond = arrival.predictTime2 > 0
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-1 text-base font-bold text-gray-900">{arrival.routeName}</div>
      <ArrivalLegInfo
        leg={{
          predictTime: arrival.predictTime1,
          locationNo: arrival.locationNo1,
          crowded: arrival.crowded1,
        }}
        primary
      />
      {showSecond && (
        <div className="mt-1">
          <ArrivalLegInfo
            leg={{
              predictTime: arrival.predictTime2,
              locationNo: arrival.locationNo2,
              crowded: arrival.crowded2,
            }}
            primary={false}
          />
        </div>
      )}
    </li>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">{message}</div>
  )
}

export function BusArrivalList({ stationId }: BusArrivalListProps) {
  const { data, isLoading, isError, error, isFetching } = useBusArrival(stationId)

  if (stationId === null) {
    return <EmptyState message="정류장을 선택하세요" />
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <LoadingSpinner />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={error instanceof Error ? error.message : '도착 정보를 불러오지 못했습니다'}
      />
    )
  }

  if (!data || data.arrivals.length === 0) {
    return <EmptyState message="도착 예정 버스가 없습니다" />
  }

  const updatedAt = data.cachedAt
    ? new Date(data.cachedAt).toLocaleTimeString('ko-KR')
    : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        {updatedAt && <span>마지막 갱신: {updatedAt}</span>}
        {isFetching && <span className="text-blue-500">갱신 중...</span>}
      </div>
      <ul className="space-y-2">
        {data.arrivals.map((arrival) => (
          <ArrivalItem key={arrival.busId} arrival={arrival} />
        ))}
      </ul>
    </div>
  )
}
