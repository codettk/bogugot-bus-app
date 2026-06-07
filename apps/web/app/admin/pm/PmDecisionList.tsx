'use client'

import { useEffect, useState } from 'react'

interface Question {
  issueNumber: number
  title: string
  question: string
  options: string[]
}

interface Decision {
  id: number
  run_date: string
  questions: Question[]
  status: string
}

export function PmDecisionList() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [answers, setAnswers] = useState<Record<number, Record<string, string>>>({})
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [triggered, setTriggered] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pm/decisions')
      .then(r => r.json() as Promise<{ decisions: Decision[] }>)
      .then(data => setDecisions(data.decisions ?? []))
      .finally(() => setLoading(false))
  }, [])

  function setAnswer(decisionId: number, issueNumber: number, value: string) {
    setAnswers(prev => ({
      ...prev,
      [decisionId]: { ...prev[decisionId], [issueNumber]: value },
    }))
  }

  async function submitAnswer(decision: Decision) {
    const decisionAnswers = answers[decision.id]
    const allAnswered = decision.questions.every(q => decisionAnswers?.[q.issueNumber])
    if (!allAnswered) {
      window.alert('모든 질문에 답변해주세요.')
      return
    }

    setSubmitting(decision.id)
    try {
      await fetch(`/api/pm/decisions/${decision.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: decisionAnswers }),
      })

      await fetch('/api/pm/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId: decision.id }),
      })

      setTriggered(true)
      setDecisions(prev => prev.filter(d => d.id !== decision.id))
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return <p className="text-gray-500">불러오는 중...</p>
  }

  if (triggered) {
    return (
      <div className="rounded-lg bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-700">워크플로우가 시작되었습니다</p>
        <p className="mt-1 text-sm text-green-600">
          백그라운드에서 오늘 작업이 진행됩니다.
        </p>
      </div>
    )
  }

  if (decisions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
        오늘 대기 중인 질문이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {decisions.map(decision => (
        <div key={decision.id} className="rounded-xl border border-gray-200 p-6 shadow-sm">
          <p className="mb-4 text-xs text-gray-400">
            {new Date(decision.run_date).toLocaleDateString('ko-KR')} 기준
          </p>

          <div className="space-y-5">
            {decision.questions.map(q => (
              <div key={q.issueNumber}>
                <p className="text-xs font-medium text-blue-600">
                  Issue #{q.issueNumber} — {q.title}
                </p>
                <p className="mt-1 text-sm font-semibold">{q.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map(opt => {
                    const selected = answers[decision.id]?.[q.issueNumber] === opt
                    return (
                      <button
                        key={opt}
                        onClick={() => setAnswer(decision.id, q.issueNumber, opt)}
                        className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-300 text-gray-700 hover:border-blue-400'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => submitAnswer(decision)}
            disabled={submitting === decision.id}
            className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting === decision.id ? '처리 중...' : '답변 제출 및 워크플로우 시작'}
          </button>
        </div>
      ))}
    </div>
  )
}
