export const meta = {
  name: 'implement-feature',
  description: '기능 구현 → 코드 검사 → 재작업 오케스트레이션',
  phases: [
    { title: 'Plan', detail: 'architect가 태스크를 subtask로 분해' },
    { title: 'Build', detail: 'agentType별 병렬 구현 (worktree 격리)' },
    { title: 'Review', detail: 'reviewer가 각 구현물 병렬 검사' },
    { title: 'Fix', detail: 'fail 항목 재작업 (최대 2회)' },
    { title: 'Report', detail: '성공/실패 요약 반환' },
  ],
}

const SUBTASKS_SCHEMA = {
  type: 'object',
  properties: {
    subtasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          agentType: {
            type: 'string',
            enum: ['backend-dev', 'frontend-dev', 'api-specialist'],
          },
          prompt: { type: 'string' },
        },
        required: ['title', 'agentType', 'prompt'],
      },
    },
  },
  required: ['subtasks'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
    feedback: { type: 'string' },
  },
  required: ['pass', 'issues', 'feedback'],
}

// ─── Phase 1: Plan ───────────────────────────────────────────────────────────
phase('Plan')
log(`태스크 분해 시작: ${args}`)

const plan = await agent(
  `다음 기능 태스크를 bogugot-bus-app 모노레포 구조에 맞게 구현 가능한 subtask 단위로 분해하세요.

태스크: ${args}

모노레포 구조:
- apps/web/app/api/       → backend-dev (Next.js API Route, Redis 캐시, SSE)
- apps/web/app/           → frontend-dev (웹 컴포넌트, TanStack Query, Zustand)
- apps/mobile/            → frontend-dev (Expo 화면, react-native-maps)
- packages/api-client/    → api-specialist (경기 버스 OpenAPI 클라이언트)
- packages/types/         → 공유 타입 (backend-dev 또는 api-specialist가 먼저 정의)

각 subtask에 담당 agentType과 상세한 구현 지시(파일 경로, 인터페이스, 제약사항 포함)를 작성하세요.
캐시 TTL 규칙: 버스 위치 10초, 정류소 정보 3600초.`,
  {
    agentType: 'architect',
    schema: SUBTASKS_SCHEMA,
    label: 'architect:plan',
    phase: 'Plan',
  }
)

if (!plan) {
  log('architect 에이전트 실행 실패 (null 반환). 태스크 분해 불가.')
  return { status: 'error', summary: 'architect agent returned null', passed: [], failed: [] }
}

log(`subtask ${plan.subtasks.length}개로 분해 완료: ${plan.subtasks.map(s => s.title).join(', ')}`)

// ─── Phase 2: Build ──────────────────────────────────────────────────────────
phase('Build')

const builds = await pipeline(
  plan.subtasks,
  (subtask) =>
    agent(subtask.prompt, {
      agentType: subtask.agentType,
      label: `build:${subtask.title}`,
      phase: 'Build',
      isolation: 'worktree',
    }),
  (result, subtask) => {
    if (result === null) {
      log(`⚠️ ${subtask.title} 구현 실패 (에이전트 오류)`)
    }
    return { subtask, result }
  }
)

const successfulBuilds = builds.filter(Boolean).filter((b) => b.result !== null)
log(`구현 완료: ${successfulBuilds.length}/${plan.subtasks.length}`)

// ─── Phase 3: Review ─────────────────────────────────────────────────────────
phase('Review')

const reviews = await parallel(
  successfulBuilds.map((b) => () =>
    agent(
      `다음 구현물을 코드 리뷰하세요.

태스크 제목: ${b.subtask.title}
담당 에이전트: ${b.subtask.agentType}

원래 구현 지시:
${b.subtask.prompt}

구현 결과:
${b.result}

검사 항목:
1. TypeScript strict 타입 안전성 (any 사용 여부, 공유 타입 활용)
2. 보안 (SQL injection, XSS, API 키 하드코딩, 환경변수 노출)
3. 성능 (N+1 쿼리, Redis 캐시 누락, TTL 준수, SSE 연결 누수)
4. 컨벤션 (kebab-case 파일명, Server/Client Component 경계, console.log)

캐시 TTL 기준: 버스 위치 10초, 정류소 3600초.`,
      {
        agentType: 'reviewer',
        label: `review:${b.subtask.title}`,
        phase: 'Review',
        schema: REVIEW_SCHEMA,
      }
    ).then((review) => ({ ...b, review }))
  )
)

const validReviews = reviews.filter(Boolean)
const passCount = validReviews.filter((r) => r.review && r.review.pass).length
log(`리뷰 완료: ${passCount}/${validReviews.length} 통과`)

// ─── Phase 4: Fix ────────────────────────────────────────────────────────────
phase('Fix')

let toFix = validReviews.filter((r) => r.review && !r.review.pass)
const fixedResults = []
let attempt = 0

while (toFix.length > 0 && attempt < 2) {
  attempt++
  log(`Fix 시도 ${attempt}/2: ${toFix.length}개 항목 재작업`)

  const fixedRound = await parallel(
    toFix.map((item) => () =>
      agent(
        `이전 구현에서 리뷰 실패가 발생했습니다. 피드백을 반영하여 재구현하세요.

태스크 제목: ${item.subtask.title}
원래 구현 지시:
${item.subtask.prompt}

리뷰 피드백:
${item.review.feedback}

발견된 문제점:
${item.review.issues.join('\n')}

위 문제점을 모두 수정하여 완전한 구현을 제공하세요.`,
        {
          agentType: item.subtask.agentType,
          label: `fix:${item.subtask.title}:attempt${attempt}`,
          phase: 'Fix',
          isolation: 'worktree',
        }
      ).then((fixResult) => {
        if (fixResult === null) return null
        return agent(
          `재구현된 코드를 리뷰하세요.

태스크 제목: ${item.subtask.title}
이전 피드백: ${item.review.feedback}

재구현 결과:
${fixResult}

이전에 발견된 문제점들이 해결되었는지 확인하고, 새로운 문제는 없는지 검사하세요.`,
          {
            agentType: 'reviewer',
            label: `re-review:${item.subtask.title}:attempt${attempt}`,
            phase: 'Fix',
            schema: REVIEW_SCHEMA,
          }
        ).then((review) => ({ ...item, result: fixResult, review }))
      })
    )
  )

  const validFixed = fixedRound.filter(Boolean)
  fixedResults.push(...validFixed)
  toFix = validFixed.filter((r) => r.review && !r.review.pass)

  const fixPassCount = validFixed.filter((r) => r.review && r.review.pass).length
  log(`Fix 시도 ${attempt} 결과: ${fixPassCount}/${validFixed.length} 통과`)
}

// ─── Phase 5: Report ─────────────────────────────────────────────────────────
phase('Report')

const initialPassed = validReviews.filter((r) => r.review && r.review.pass)
const fixedAndPassed = fixedResults.filter((r) => r.review && r.review.pass)
const stillFailed = toFix

const totalPassed = initialPassed.length + fixedAndPassed.length
const totalFailed = stillFailed.length

log(`최종 결과: ${totalPassed} 통과 / ${totalFailed} 실패`)

return {
  summary: `${totalPassed} passed, ${totalFailed} failed (${plan.subtasks.length} total subtasks)`,
  passed: initialPassed.map((r) => r.subtask.title),
  fixedAndPassed: fixedAndPassed.map((r) => r.subtask.title),
  failed: stillFailed.map((r) => ({
    title: r.subtask.title,
    issues: r.review ? r.review.issues : [],
    feedback: r.review ? r.review.feedback : '리뷰 데이터 없음',
  })),
}
