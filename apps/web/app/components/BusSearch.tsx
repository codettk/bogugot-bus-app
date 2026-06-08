'use client'

import { useState } from 'react'
import type { BusRoute, BusStop } from '@bogugot/types'
import { LoadingSpinner, ErrorMessage } from '@bogugot/ui'
import { useDebounce } from '../hooks/use-debounce'
import { useRouteSearch } from '../hooks/use-route-search'
import { useStopSearch } from '../hooks/use-stop-search'
import { useBusStore } from '../stores/use-bus-store'

type SearchType = 'route' | 'stop'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '검색 중 오류가 발생했습니다'
}

export function BusSearch() {
  const [keyword, setKeyword] = useState<string>('')
  const [type, setType] = useState<SearchType>('route')
  const setSelectedRoute = useBusStore((s) => s.setSelectedRoute)

  const debounced = useDebounce(keyword, 300)
  const trimmed = debounced.trim()
  const ready = trimmed.length >= 2

  // 비활성 탭에는 빈 문자열을 넘겨 enabled=false가 되도록 한다.
  const routeQuery = useRouteSearch(type === 'route' && ready ? trimmed : '')
  const stopQuery = useStopSearch(type === 'stop' && ready ? trimmed : '')

  const activeQuery = type === 'route' ? routeQuery : stopQuery

  return (
    <section className="w-full max-w-xl">
      <div className="mb-4 flex gap-2" role="tablist" aria-label="검색 유형">
        <button
          type="button"
          role="tab"
          aria-selected={type === 'route'}
          onClick={() => setType('route')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            type === 'route'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          노선
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={type === 'stop'}
          onClick={() => setType('stop')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            type === 'stop'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          정류장
        </button>
      </div>

      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="노선 또는 정류장 검색 (2자 이상)"
        aria-label="노선 또는 정류장 검색"
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      <div className="mt-4">
        {!ready && (
          <p className="text-sm text-gray-500">2자 이상 입력하세요</p>
        )}

        {ready && activeQuery.isLoading && (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        )}

        {ready && activeQuery.isError && (
          <ErrorMessage message={toMessage(activeQuery.error)} />
        )}

        {ready &&
          !activeQuery.isLoading &&
          !activeQuery.isError &&
          type === 'route' && (
            <RouteResults
              results={routeQuery.data ?? []}
              onSelect={setSelectedRoute}
            />
          )}

        {ready &&
          !activeQuery.isLoading &&
          !activeQuery.isError &&
          type === 'stop' && <StopResults results={stopQuery.data ?? []} />}
      </div>
    </section>
  )
}

function RouteResults({
  results,
  onSelect,
}: {
  results: BusRoute[]
  onSelect: (routeId: string) => void
}) {
  if (results.length === 0) {
    return <p className="text-sm text-gray-500">검색 결과가 없습니다</p>
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {results.map((route) => (
        <li key={route.routeId}>
          <button
            type="button"
            onClick={() => onSelect(route.routeId)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
          >
            <span className="font-semibold text-gray-900">
              {route.routeName}
            </span>
            <span className="text-sm text-gray-500">{route.routeTypeName}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function StopResults({ results }: { results: BusStop[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-gray-500">검색 결과가 없습니다</p>
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {results.map((stop) => (
        <li
          key={stop.stationId}
          className="flex items-center justify-between px-4 py-3"
        >
          <span className="font-semibold text-gray-900">
            {stop.stationName}
          </span>
          <span className="text-sm text-gray-500">{stop.mobileNo}</span>
        </li>
      ))}
    </ul>
  )
}
