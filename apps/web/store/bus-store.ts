import { create } from 'zustand'
import type { BusLocation } from '@bogugot/types'

interface BusStore {
  selectedRouteId: string | null
  busLocations: Map<string, BusLocation[]>
  setSelectedRoute: (routeId: string | null) => void
  updateLocations: (routeId: string, locations: BusLocation[]) => void
}

export const useBusStore = create<BusStore>((set) => ({
  selectedRouteId: null,
  busLocations: new Map<string, BusLocation[]>(),

  setSelectedRoute: (routeId) =>
    set({ selectedRouteId: routeId }),

  updateLocations: (routeId, locations) =>
    set((state) => {
      const next = new Map(state.busLocations)
      next.set(routeId, locations)
      return { busLocations: next }
    }),
}))
