import type { BusLocation, BusArrival, BusStop, BusRoute } from '@bogugot/types'
import { GyeonggiApiError } from './errors'

const BASE_URL = 'https://apis.data.go.kr/6410000'

function getApiKey(): string {
  const key = process.env.GYEONGGI_BUS_API_KEY
  if (!key) throw new Error('GYEONGGI_BUS_API_KEY 환경변수가 설정되지 않았습니다')
  return key
}

interface ApiResponse<T> {
  response: {
    msgHeader: { resultCode: number; resultMessage: string; queryTime: string }
    msgBody: T
  }
}

async function fetchApi<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, BASE_URL)
  url.searchParams.set('serviceKey', getApiKey())
  url.searchParams.set('format', 'json')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString())
  if (!res.ok) throw new GyeonggiApiError(`API 요청 실패: ${res.status}`, res.status)

  const json = await res.json() as ApiResponse<T>
  const { resultCode, resultMessage } = json.response.msgHeader
  if (resultCode !== 0) throw new GyeonggiApiError(resultMessage, undefined, String(resultCode))

  return json.response.msgBody
}

export const gyeonggiApi = {
  getBusLocations: (routeId: string) =>
    fetchApi<{ busLocationList: BusLocation[] }>('/buslocationservice/v2/getBusLocationListv2', { routeId }),

  getBusArrivals: (stationId: string) =>
    fetchApi<{ busArrivalList: BusArrival[] }>('/busarrivalservice/v2/getBusArrivalListv2', { stationId }),

  searchStations: (keyword: string) =>
    fetchApi<{ busStationList: BusStop[] }>('/busstationservice/v2/getBusStationListv2', { keyword }),

  searchRoutes: (keyword: string) =>
    fetchApi<{ busRouteList: BusRoute[] }>('/busrouteservice/v2/getBusRouteListv2', { keyword }),
}
