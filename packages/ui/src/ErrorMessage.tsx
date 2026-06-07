'use client'

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
      {message}
    </div>
  )
}
