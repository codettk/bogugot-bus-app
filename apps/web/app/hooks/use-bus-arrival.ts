'use client'

import { useQuery } from '@tanstack/react-query'
import type { BusArrival } from '@bogugot/types'

async function fetchBusArrivals(stationId: string): Promise<BusArrival[]> {
  const res = await fetch(`/api/bus/arrival/${encodeURIComponent(stationId)}`)
  if (!res.ok) throw new Error('도착 정보 조회에 실패했습니다')
  const data = await res.json() as { arrivals: BusArrival[] }
  return data.arrivals
}

export function useBusArrival(stationId: string | null) {
  return useQuery({
    queryKey: ['arrivals', stationId],
    queryFn: () => fetchBusArrivals(stationId!),
    enabled: stationId !== null,
    refetchInterval: 30_000, // 30초마다 갱신
    staleTime: 20_000,
  })
}
