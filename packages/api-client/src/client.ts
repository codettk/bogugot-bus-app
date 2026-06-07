import type { BusLocation, BusArrival, BusStop, BusRoute } from '@bogugot/types'
import { GyeonggiApiError } from './errors'

const BASE_URL = 'https://openapi.gg.go.kr'

function getApiKey(): string {
  const key = process.env.GYEONGGI_BUS_API_KEY
  if (!key) throw new Error('GYEONGGI_BUS_API_KEY 환경변수가 설정되지 않았습니다')
  return key
}

async function fetchApi<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, BASE_URL)
  url.searchParams.set('serviceKey', getApiKey())
  url.searchParams.set('format', 'json')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString())
  if (!res.ok) throw new GyeonggiApiError(`API 요청 실패: ${res.status}`, res.status)

  const json = await res.json()
  if (json.error) throw new GyeonggiApiError(json.error.message, undefined, json.error.code)

  return json as T
}

export const gyeonggiApi = {
  getBusLocations: (routeId: string) =>
    fetchApi<{ items: BusLocation[] }>('/BusLocationList', { routeId }),

  getBusArrivals: (stationId: string) =>
    fetchApi<{ items: BusArrival[] }>('/BusArrivalList', { stationId }),

  getBusStop: (stationId: string) =>
    fetchApi<{ item: BusStop }>('/BusStationInfo', { stationId }),

  searchRoutes: (keyword: string) =>
    fetchApi<{ items: BusRoute[] }>('/BusRouteList', { keyword }),
}
