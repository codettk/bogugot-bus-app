import { NextResponse } from 'next/server'
import type { BusArrival } from '@bogugot/types'
import { gyeonggiApi, withCache, CACHE_TTL, GyeonggiApiError } from '@bogugot/api-client'
import { redis } from '@/lib/redis'

interface ArrivalResponse {
  arrivals: BusArrival[]
  cachedAt: number
}

export async function GET(
  _request: Request,
  { params }: { params: { stationId: string } },
): Promise<Response> {
  const { stationId } = params

  if (!stationId) {
    return NextResponse.json({ error: 'stationId는 필수입니다' }, { status: 400 })
  }

  try {
    const cacheKey = `bus:arrival:${stationId}`
    const cachedAt = Date.now()

    const body = await withCache(
      redis,
      cacheKey,
      CACHE_TTL.BUS_ARRIVAL,
      () => gyeonggiApi.getBusArrivals(stationId),
    )

    const response: ArrivalResponse = {
      arrivals: body.busArrivalList,
      cachedAt,
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
