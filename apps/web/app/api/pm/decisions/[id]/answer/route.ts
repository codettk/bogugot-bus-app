import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '잘못된 ID' }, { status: 400 })
  }

  const body = await request.json() as { answers: Record<string, unknown> }
  if (!body.answers || typeof body.answers !== 'object') {
    return NextResponse.json({ error: 'answers 필드가 필요합니다' }, { status: 400 })
  }

  const result = await db.query(
    `UPDATE pm_decisions
     SET answers = $1, status = 'answered', answered_at = NOW()
     WHERE id = $2 AND status = 'pending'
     RETURNING id, status`,
    [JSON.stringify(body.answers), id],
  )

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: '해당 항목이 없거나 이미 처리된 상태입니다' },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, id, status: 'answered' })
}
