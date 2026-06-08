'use client'

import { useQuery } from '@tanstack/react-query'
import type { BusStop } from '@bogugot/types'

async function fetchStopSearch(keyword: string): Promise<BusStop[]> {
  const res = await fetch(
    `/api/bus/search?type=stop&keyword=${encodeURIComponent(keyword)}`,
  )
  if (!res.ok) throw new Error('정류장 검색에 실패했습니다')
  const data = (await res.json()) as { type: 'stop'; results: BusStop[]; keyword: string }
  return data.results
}

export function useStopSearch(keyword: string) {
  return useQuery({
    queryKey: ['stops', 'search', keyword],
    queryFn: () => fetchStopSearch(keyword),
    enabled: keyword.trim().length > 0,
    staleTime: 60 * 60 * 1000, // 1시간
  })
}
