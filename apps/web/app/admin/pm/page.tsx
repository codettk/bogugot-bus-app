import { PmDecisionList } from './PmDecisionList'

export const dynamic = 'force-dynamic'

export default function PmAdminPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">PM 대기 질문</h1>
      <p className="mb-8 text-sm text-gray-500">
        오늘 PM이 판단하지 못한 항목들입니다. 답변 후 워크플로우가 자동으로 재시작됩니다.
      </p>
      <PmDecisionList />
    </main>
  )
}
