import Link from 'next/link'
import { BusSearch } from './components/BusSearch'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-3xl font-bold">경기 버스</h1>
      <p className="mt-2 text-gray-500">실시간 버스 위치 추적 서비스</p>

      <div className="mt-8 w-full max-w-xl">
        <BusSearch />
      </div>

      <Link
        href="/map"
        className="mt-8 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        실시간 버스 지도 보기
      </Link>
    </main>
  )
}
