import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '경기 버스',
  description: '경기도 버스 실시간 위치 추적',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
