'use client'

import { useState } from 'react'
import { useBusStore } from '../stores/use-bus-store'
import { BusMap } from '../components/BusMap'

export function MapView() {
  const selectedRouteId = useBusStore((state) => state.selectedRouteId)
  const setSelectedRoute = useBusStore((state) => state.setSelectedRoute)
  const [input, setInput] = useState('')

  const handleApply = () => {
    const routeId = input.trim()
    setSelectedRoute(routeId.length > 0 ? routeId : null)
  }

  return (
    <div className="flex flex-1 flex-col">
      <form
        className="flex items-center gap-2 border-b border-gray-200 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          handleApply()
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="노선 ID 입력 (예: 234001234)"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          aria-label="노선 ID"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          적용
        </button>
      </form>

      <div className="relative flex-1">
        {selectedRouteId ? (
          <BusMap routeId={selectedRouteId} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-50 p-4 text-center text-sm text-gray-500">
            노선 ID를 입력하고 적용하면 실시간 버스 위치가 지도에 표시됩니다.
          </div>
        )}
      </div>
    </div>
  )
}
