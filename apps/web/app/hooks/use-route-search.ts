'use client'

import { useQuery } from '@tanstack/react-query'
import type { BusRoute } from '@bogugot/types'

async function fetchRouteSearch(keyword: string): Promise<BusRoute[]> {
  const res = await fetch(
    `/api/bus/search?type=route&keyword=${encodeURIComponent(keyword)}`,
  )
  if (!res.ok) throw new Error('노선 검색에 실패했습니다')
  const data = await res.json() as { type: 'route'; results: BusRoute[]; keyword: string }
  return data.results
}

export function useRouteSearch(keyword: string) {
  return useQuery({
    queryKey: ['routes', 'search', keyword],
    queryFn: () => fetchRouteSearch(keyword),
    enabled: keyword.trim().length > 0,
    staleTime: 60 * 60 * 1000, // 1시간
  })
}
