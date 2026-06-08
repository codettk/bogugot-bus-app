export const meta = {
  name: 'implement-feature',
  description: '기능 구현 → 코드 검사 → 재작업 → 통합(PR) 오케스트레이션',
  phases: [
    { title: 'Plan', detail: 'architect가 태스크를 subtask로 분해' },
    { title: 'Build', detail: 'agentType별 병렬 구현 (worktree 격리 + 커밋)' },
    { title: 'Review', detail: 'reviewer가 각 구현물 병렬 검사' },
    { title: 'Fix', detail: 'fail 항목 재작업 (최대 2회)' },
    { title: 'Integrate', detail: '통과 브랜치를 통합 브랜치로 병합 + tsc 검증 + PR 생성' },
    { title: 'Report', detail: '성공/실패/PR 요약 반환' },
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

// 빌드/수정 에이전트는 worktree 브랜치에 커밋한 뒤 브랜치명과 구현 내용을 반환한다.
const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    committed: { type: 'boolean' },
    implementation: { type: 'string' },
  },
  required: ['branch', 'committed', 'implementation'],
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

const INTEGRATE_SCHEMA = {
  type: 'object',
  properties: {
    integrationBranch: { type: 'string' },
    mergedBranches: { type: 'array', items: { type: 'string' } },
    tscPassed: { type: 'boolean' },
    pushed: { type: 'boolean' },
    prUrl: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['integrationBranch', 'mergedBranches', 'tscPassed', 'pushed', 'notes'],
}

// args는 두 형태를 모두 지원한다.
//  - 문자열: `/implement-feature "..."` 단독 실행 (태스크 설명)
//  - 객체: daily-planning이 { task, issueNumber, title } 로 위임
const taskPrompt = typeof args === 'string' ? args : (args && args.task) || ''
const issueRef =
  args && typeof args === 'object' && typeof args.issueNumber === 'number'
    ? args.issueNumber
    : null

// ─── Phase 1: Plan ───────────────────────────────────────────────────────────
phase('Plan')
log(`태스크 분해 시작: ${taskPrompt}`)

const plan = await agent(
  `다음 기능 태스크를 bogugot-bus-app 모노레포 구조에 맞게 구현 가능한 subtask 단위로 분해하세요.

태스크: ${taskPrompt}

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

// worktree 빌드 에이전트가 자기 브랜치에 커밋하도록 지시하는 공통 안내문
const COMMIT_INSTRUCTIONS = `

---
[작업 환경 안내]
너는 이 워크플로우가 만든 격리된 git worktree 안에서 동작한다. 구현을 마치면 반드시 다음을 수행해라:
1. 변경/생성한 모든 파일을 저장한다.
2. \`git add -A && git commit -m "feat: <간단한 제목>"\` 로 현재 worktree 브랜치에 커밋한다.
3. \`git rev-parse --abbrev-ref HEAD\` 로 현재 브랜치명을 확인한다.

반환값(JSON):
- branch: 위에서 확인한 현재 브랜치명 (정확히 그대로)
- committed: 커밋에 성공했으면 true
- implementation: 리뷰어가 검토할 수 있도록, 변경한 핵심 파일들의 경로와 최종 내용을 포함한 구현 요약
`

// ─── Phase 2: Build ──────────────────────────────────────────────────────────
phase('Build')

const builds = await pipeline(
  plan.subtasks,
  (subtask) =>
    agent(subtask.prompt + COMMIT_INSTRUCTIONS, {
      agentType: subtask.agentType,
      label: `build:${subtask.title}`,
      phase: 'Build',
      isolation: 'worktree',
      schema: BUILD_SCHEMA,
    }),
  (result, subtask) => {
    if (result === null) {
      log(`⚠️ ${subtask.title} 구현 실패 (에이전트 오류)`)
    } else if (!result.committed) {
      log(`⚠️ ${subtask.title} 커밋 실패 — 통합에서 제외될 수 있음`)
    }
    return { subtask, result }
  }
)

const successfulBuilds = builds
  .filter(Boolean)
  .filter((b) => b.result !== null)
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
${b.result.implementation}

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

위 문제점을 모두 수정하여 완전한 구현을 제공하세요.${COMMIT_INSTRUCTIONS}`,
        {
          agentType: item.subtask.agentType,
          label: `fix:${item.subtask.title}:attempt${attempt}`,
          phase: 'Fix',
          isolation: 'worktree',
          schema: BUILD_SCHEMA,
        }
      ).then((fixResult) => {
        if (fixResult === null) return null
        return agent(
          `재구현된 코드를 리뷰하세요.

태스크 제목: ${item.subtask.title}
이전 피드백: ${item.review.feedback}

재구현 결과:
${fixResult.implementation}

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

// ─── Phase 5: Integrate ──────────────────────────────────────────────────────
// 리뷰를 통과한 worktree 브랜치들을 하나의 통합 브랜치로 병합하고, tsc로 검증한 뒤
// 원격에 push + PR 생성. master에 직접 머지하지 않고 사람이 검토하도록 PR로 올린다.
phase('Integrate')

const initialPassed = validReviews.filter((r) => r.review && r.review.pass)
const fixedAndPassed = fixedResults.filter((r) => r.review && r.review.pass)
const allPassed = [...initialPassed, ...fixedAndPassed]

const passedBranches = allPassed
  .map((r) => r.result && r.result.branch)
  .filter((b) => typeof b === 'string' && b.length > 0)

let integration = null

if (passedBranches.length === 0) {
  log('통합할 통과 브랜치가 없습니다. Integrate 단계를 건너뜁니다.')
} else {
  const integrationBranchName = issueRef
    ? `auto/issue-${issueRef}`
    : `auto/impl-${plan.subtasks.length}-subtasks`

  log(`통합 시작: ${passedBranches.length}개 브랜치 → ${integrationBranchName}`)

  integration = await agent(
    `너는 메인 git working tree에서 동작한다(격리 worktree 아님). 아래 절차를 정확히 수행해라.

목표: 리뷰를 통과한 worktree 브랜치들을 하나의 통합 브랜치로 병합하고, 타입 검사 후 PR을 생성한다.

통과한 브랜치 목록:
${passedBranches.map((b) => `- ${b}`).join('\n')}

통합 브랜치명: ${integrationBranchName}
${issueRef ? `관련 이슈 번호: #${issueRef}` : '(관련 이슈 없음 — 단독 실행)'}

절차:
1. 현재 작업트리가 깨끗한지 확인한다. 변경사항이 있으면 \`git stash -u\` 로 잠시 치워두고, 모든 작업이 끝난 뒤 \`git stash pop\` 한다.
2. \`git checkout master\` 후, \`git checkout -B ${integrationBranchName}\` 로 통합 브랜치를 만든다(master 기준).
3. 통과한 각 브랜치를 \`git merge --no-ff <branch> -m "merge: <branch>"\` 로 병합한다. 충돌이 나면 해당 브랜치는 건너뛰고 notes에 기록한다.
4. \`pnpm install --frozen-lockfile=false\` 후 \`pnpm tsc\` 로 타입 검사를 실행한다. 실패하면 가능한 범위에서 수정 후 다시 검사한다.
5. tsc가 통과하면 \`git push -u origin ${integrationBranchName}\` 로 푸시하고, \`gh pr create --base master --head ${integrationBranchName} --title "..." --body "..."\` 로 PR을 만든다.${issueRef ? ` PR 본문에 "Closes #${issueRef}" 를 포함한다.` : ''}
6. gh가 출력한 PR URL을 prUrl로 반환한다. push/PR에 실패하면 pushed=false로 두고 notes에 원인을 적는다.

환경변수 GITHUB_TOKEN / GITHUB_REPO 와 인증된 gh CLI 를 사용할 수 있다.

반환값(JSON): integrationBranch, mergedBranches(실제로 병합 성공한 브랜치 배열), tscPassed, pushed, prUrl(없으면 빈 문자열), notes.`,
    {
      agentType: 'backend-dev',
      label: 'integrate',
      phase: 'Integrate',
      schema: INTEGRATE_SCHEMA,
    }
  )

  if (integration) {
    log(
      `통합 결과: ${integration.mergedBranches.length}개 병합, tsc ${integration.tscPassed ? '통과' : '실패'}, ` +
        `${integration.pushed ? `PR: ${integration.prUrl || '(URL 없음)'}` : 'push 안 됨'}`
    )
  } else {
    log('통합 에이전트 실행 실패 (null 반환).')
  }
}

// ─── Phase 6: Report ─────────────────────────────────────────────────────────
phase('Report')

const stillFailed = toFix
const totalPassed = allPassed.length
const totalFailed = stillFailed.length

log(`최종 결과: ${totalPassed} 통과 / ${totalFailed} 실패`)

return {
  summary:
    `${totalPassed} passed, ${totalFailed} failed (${plan.subtasks.length} total subtasks)` +
    (integration && integration.pushed && integration.prUrl ? ` — PR: ${integration.prUrl}` : ''),
  passed: initialPassed.map((r) => r.subtask.title),
  fixedAndPassed: fixedAndPassed.map((r) => r.subtask.title),
  failed: stillFailed.map((r) => ({
    title: r.subtask.title,
    issues: r.review ? r.review.issues : [],
    feedback: r.review ? r.review.feedback : '리뷰 데이터 없음',
  })),
  integration: integration
    ? {
        branch: integration.integrationBranch,
        merged: integration.mergedBranches,
        tscPassed: integration.tscPassed,
        prUrl: integration.pushed ? integration.prUrl || null : null,
        notes: integration.notes,
      }
    : null,
}
