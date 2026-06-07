import type { BusLocation } from './bus'

export interface BusLocationEvent {
  type: 'bus-location'
  routeId: string
  locations: BusLocation[]
  timestamp: number
}

export interface BusArrivalEvent {
  type: 'bus-arrival'
  stationId: string
  timestamp: number
}

export interface HeartbeatEvent {
  type: 'heartbeat'
  timestamp: number
}

export interface SseErrorEvent {
  type: 'error'
  message: string
  timestamp: number
}

export type SseEvent = BusLocationEvent | BusArrivalEvent | HeartbeatEvent | SseErrorEvent

export interface SseMessage<T> {
  data: T
  id?: string
  retry?: number
}
