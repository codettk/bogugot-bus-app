import { MapView } from './MapView'

export default function MapPage() {
  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold">실시간 버스 지도</h1>
        <p className="mt-1 text-sm text-gray-500">노선을 선택하면 운행 중인 버스 위치가 표시됩니다.</p>
      </header>
      <MapView />
    </main>
  )
}
