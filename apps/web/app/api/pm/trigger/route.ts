import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const body = await request.json() as { decisionId?: number }

  // 오늘 answered 상태인 결정 조회
  const today = new Date().toISOString().split('T')[0]
  const result = await db.query<{ id: number; answers: unknown }>(
    `SELECT id, answers FROM pm_decisions
     WHERE run_date = $1 AND status = 'answered'
     ORDER BY answered_at DESC
     LIMIT 1`,
    [body.decisionId ? [today] : [today]],
  )

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: '답변된 항목이 없습니다' },
      { status: 404 },
    )
  }

  const decision = result.rows[0]
  const argsPayload = JSON.stringify({
    date: today,
    answers: decision?.answers,
  })

  // daily-planning 워크플로우를 백그라운드로 재실행
  const projectDir = process.cwd().replace(/[\\/]apps[\\/]web$/, '')
  const child = spawn(
    'claude',
    ['--workflow', 'daily-planning', '--args', argsPayload],
    {
      cwd: projectDir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    },
  )
  child.unref()

  // 상태를 executed로 업데이트
  await db.query(
    `UPDATE pm_decisions SET status = 'executed' WHERE id = $1`,
    [decision?.id],
  )

  return NextResponse.json({
    ok: true,
    message: 'daily-planning 워크플로우가 백그라운드에서 시작되었습니다',
    decisionId: decision?.id,
  })
}
