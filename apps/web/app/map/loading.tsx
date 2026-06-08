import { LoadingSpinner } from '@bogugot/ui'

export default function MapLoading() {
  return (
    <main className="flex h-screen w-full items-center justify-center">
      <LoadingSpinner size={32} />
    </main>
  )
}
