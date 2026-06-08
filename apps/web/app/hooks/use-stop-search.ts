'use client'

import { useQuery } from '@tanstack/react-query'
import type { BusStop } from '@bogugot/types'

async function fetchStopSearch(keyword: string): Promise<BusStop[]> {
  const res = await fetch(
    `/api/bus/search?type=stop&keyword=${encodeURIComponent(keyword)}`,
  )
  if (!res.ok) {
    const message = await res
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined)
    throw new Error(message ?? '정류장 검색에 실패했습니다')
  }
  const data = await res.json() as { type: 'stop'; results: BusStop[]; keyword: string }
  return data.results
}

export function useStopSearch(keyword: string) {
  return useQuery({
    queryKey: ['stops', 'search', keyword],
    queryFn: () => fetchStopSearch(keyword),
    enabled: keyword.trim().length >= 2, // API 최소 2자 요구
    staleTime: 60 * 60 * 1000, // 1시간 (정류소 정보 캐시 정책)
  })
}
