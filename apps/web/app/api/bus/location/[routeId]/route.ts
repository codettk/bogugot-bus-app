import type { BusLocationEvent, HeartbeatEvent, SseErrorEvent } from '@bogugot/types'
import { gyeonggiApi, withCache, CACHE_TTL } from '@bogugot/api-client'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 10_000
const HEARTBEAT_INTERVAL_MS = 30_000

export async function GET(
  _req: Request,
  { params }: { params: { routeId: string } },
) {
  const { routeId } = params

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      function send(event: BusLocationEvent | HeartbeatEvent | SseErrorEvent): void {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      async function fetchLocations(): Promise<void> {
        try {
          const body = await withCache(
            redis,
            `bus:location:${routeId}`,
            CACHE_TTL.BUS_LOCATION,
            () => gyeonggiApi.getBusLocations(routeId),
          )
          const event: BusLocationEvent = {
            type: 'bus-location',
            routeId,
            locations: body.busLocationList,
            timestamp: Date.now(),
          }
          send(event)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '알 수 없는 오류'
          const event: SseErrorEvent = {
            type: 'error',
            message,
            timestamp: Date.now(),
          }
          send(event)
        }
      }

      // 첫 데이터 즉시 전송
      await fetchLocations()

      const pollTimer = setInterval(() => {
        void fetchLocations()
      }, POLL_INTERVAL_MS)

      const heartbeatTimer = setInterval(() => {
        const event: HeartbeatEvent = {
          type: 'heartbeat',
          timestamp: Date.now(),
        }
        send(event)
      }, HEARTBEAT_INTERVAL_MS)

      // 클라이언트 연결 종료 감지
      _req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(pollTimer)
        clearInterval(heartbeatTimer)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
