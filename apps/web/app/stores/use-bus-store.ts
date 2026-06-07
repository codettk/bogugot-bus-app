'use client'

import { create } from 'zustand'

interface BusStore {
  selectedRouteId: string | null
  setSelectedRoute: (routeId: string | null) => void
}

export const useBusStore = create<BusStore>()((set) => ({
  selectedRouteId: null,
  setSelectedRoute: (routeId) => set({ selectedRouteId: routeId }),
}))
