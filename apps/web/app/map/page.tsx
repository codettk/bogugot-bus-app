import { BusMap } from '@/app/components/BusMap'
import { RouteSelector } from '@/app/components/RouteSelector'

interface MapPageProps {
  searchParams: { routeId?: string }
}

export default function MapPage({ searchParams }: MapPageProps) {
  const routeId = searchParams.routeId ?? null

  return (
    <main className="relative h-screen w-full">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex justify-center p-3">
        <RouteSelector initialRouteId={routeId} />
      </div>
      <BusMap routeId={routeId} />
    </main>
  )
}
