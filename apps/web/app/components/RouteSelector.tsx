'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface RouteSelectorProps {
  initialRouteId?: string | null
}

export function RouteSelector({ initialRouteId }: RouteSelectorProps) {
  const router = useRouter()
  const [value, setValue] = useState(initialRouteId ?? '')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const routeId = value.trim()
    if (!routeId) return
    router.push(`/map?routeId=${encodeURIComponent(routeId)}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="pointer-events-auto flex gap-2 rounded-lg bg-white/90 p-2 shadow-md backdrop-blur"
    >
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="노선 ID 입력"
        aria-label="노선 ID"
        className="w-40 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        조회
      </button>
    </form>
  )
}
