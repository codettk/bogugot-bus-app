export const CACHE_TTL = {
  BUS_LOCATION: 10,    // 10초 — 실시간성 요구
  STOP_INFO: 3600,     // 1시간 — 변경 빈도 낮음
  ROUTE_INFO: 3600,    // 1시간 — 변경 빈도 낮음
} as const

export async function withCache<T>(
  redis: { get: (key: string) => Promise<string | null>; setex: (key: string, ttl: number, value: string) => Promise<unknown> },
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached) as T

  const data = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(data))
  return data
}
