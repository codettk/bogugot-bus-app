import { NextRequest, NextResponse } from 'next/server'
import type { BusRoute, BusStop } from '@bogugot/types'
import { gyeonggiApi, withCache, CACHE_TTL, GyeonggiApiError } from '@bogugot/api-client'
import { redis } from '@/lib/redis'

type SearchType = 'route' | 'stop'

interface SearchRouteResponse {
  type: 'route'
  results: BusRoute[]
  keyword: string
}

interface SearchStopResponse {
  type: 'stop'
  results: BusStop[]
  keyword: string
}

type SearchResponse = SearchRouteResponse | SearchStopResponse

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') as SearchType | null
  const keyword = searchParams.get('keyword')

  if (!keyword || keyword.length < 2) {
    return NextResponse.json(
      { error: 'keyword는 최소 2자 이상이어야 합니다' },
      { status: 400 },
    )
  }

  if (type !== 'route' && type !== 'stop') {
    return NextResponse.json(
      { error: "type은 'route' 또는 'stop'이어야 합니다" },
      { status: 400 },
    )
  }

  try {
    if (type === 'route') {
      const cacheKey = `route:info:${keyword}`
      const body = await withCache(
        redis,
        cacheKey,
        CACHE_TTL.ROUTE_INFO,
        () => gyeonggiApi.searchRoutes(keyword),
      )

      const response: SearchRouteResponse = {
        type: 'route',
        results: body.busRouteList,
        keyword,
      }
      return NextResponse.json(response)
    }

    // type === 'stop'
    const cacheKey = `stop:info:search:${keyword}`
    const body = await withCache(
      redis,
      cacheKey,
      CACHE_TTL.STOP_INFO,
      () => gyeonggiApi.searchStations(keyword),
    )

    const response: SearchStopResponse = {
      type: 'stop',
      results: body.busStationList,
      keyword,
    }
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof GyeonggiApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode ?? 502 },
      )
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
