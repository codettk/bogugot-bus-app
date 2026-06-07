import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const today = new Date().toISOString().split('T')[0]

  const result = await db.query(
    `SELECT id, run_date, questions, answers, status, created_at
     FROM pm_decisions
     WHERE run_date = $1
     ORDER BY created_at DESC`,
    [today],
  )

  return NextResponse.json({ decisions: result.rows, date: today })
}
