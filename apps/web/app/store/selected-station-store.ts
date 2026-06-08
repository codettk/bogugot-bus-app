import { create } from 'zustand'
import type { BusStop } from '@bogugot/types'

interface SelectedStationState {
  selectedStation: BusStop | null
  selectStation: (station: BusStop) => void
  clearStation: () => void
}

export const useSelectedStationStore = create<SelectedStationState>((set) => ({
  selectedStation: null,
  selectStation: (station) => set({ selectedStation: station }),
  clearStation: () => set({ selectedStation: null }),
}))
