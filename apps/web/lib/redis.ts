import Redis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var _redisInstance: Redis | undefined
}

function createRedis(): Redis {
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL 환경변수가 설정되지 않았습니다')
  return new Redis(url, { lazyConnect: false })
}

export const redis: Redis =
  globalThis._redisInstance ?? (globalThis._redisInstance = createRedis())
