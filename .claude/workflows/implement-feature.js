export const meta = {
  name: 'implement-feature',
  description: '기능 구현 → 코드 검사 → 재작업 → 통합(PR) 오케스트레이션 (단일 브랜치 순차 빌드)',
  phases: [
    { title: 'Plan', detail: 'architect가 태스크를 subtask로 분해' },
    { title: 'Build', detail: '단일 통합 브랜치에서 subtask 순차 구현+커밋 (격리 없음)' },
    { title: 'Review', detail: 'reviewer가 각 구현물 병렬 검사' },
    { title: 'Fix', detail: 'fail 항목 순차 재작업 (최대 2회)' },
    { title: 'Integrate', detail: 'tsc 검증 + push + PR 생성' },
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

// 빌드/수정 에이전트는 통합 브랜치에 커밋하고 구현 내용을 반환한다.
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
    tscPassed: { type: 'boolean' },
    pushed: { type: 'boolean' },
    prUrl: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['integrationBranch', 'tscPassed', 'pushed', 'notes'],
}

// args는 두 형태를 모두 지원한다.
//  - 문자열: `/implement-feature "..."` 단독 실행 (태스크 설명)
//  - 객체: daily-planning이 { task, issueNumber, title } 로 위임
const taskPrompt = typeof args === 'string' ? args : (args && args.task) || ''
const issueRef =
  args && typeof args === 'object' && typeof args.issueNumber === 'number'
    ? args.issueNumber
    : null
const branchName = issueRef ? `auto/issue-${issueRef}` : `auto/impl-feature`

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

subtask는 **순차적으로** 같은 작업트리에 쌓인다(뒤 subtask는 앞 subtask가 만든 파일을 볼 수 있다).
- 의존 순서를 고려해 배열 순서를 정하라(예: 공유 타입/훅/Provider 같은 기반 작업을 먼저).
- 공용 파일(타입, 훅, Provider 등)은 **한 subtask에서만** 생성하도록 분배하고, 나머지는 그것을 재사용한다고 명시하라.
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

// 빌드/수정 에이전트 공통 안내: 단일 통합 브랜치에 순차 커밋(격리 worktree 아님)
const buildEnv = `

---
[작업 환경 안내 — 단일 통합 브랜치 순차 빌드]
너는 메인 git working tree에서 동작한다(격리 worktree 아님). 모든 subtask는 통합 브랜치 \`${branchName}\` 에 순서대로 쌓인다.
1. 현재 브랜치를 확인한다(\`git rev-parse --abbrev-ref HEAD\`).
   - 이미 \`${branchName}\` 이면 그대로 둔다.
   - \`${branchName}\` 브랜치가 이미 존재하면 \`git checkout ${branchName}\`.
   - 없으면 \`git checkout master && git checkout -b ${branchName}\` (master 기준 생성).
2. 이전 subtask가 만든 파일이 이미 트리에 있을 수 있다. **같은 파일을 중복 생성/덮어쓰지 말고** 기존 내용을 읽어 재사용·확장하라(특히 공용 훅/Provider/타입).
3. 구현을 마치면 \`git add -A && git commit -m "feat: <간단한 제목>"\` 로 \`${branchName}\` 에 커밋한다.
반환값(JSON): branch(\`${branchName}\`), committed(커밋 성공 여부), implementation(리뷰어가 검토할 수 있도록 변경한 핵심 파일 경로+최종 내용 요약).
`

// ─── Phase 2: Build (순차) ────────────────────────────────────────────────────
phase('Build')
log(`통합 브랜치 ${branchName} 에서 ${plan.subtasks.length}개 subtask 순차 빌드`)

const builds = []
for (const subtask of plan.subtasks) {
  log(`build: ${subtask.title}`)
  const result = await agent(subtask.prompt + buildEnv, {
    agentType: subtask.agentType,
    label: `build:${subtask.title}`,
    phase: 'Build',
    schema: BUILD_SCHEMA,
  })
  if (result === null) {
    log(`⚠️ ${subtask.title} 구현 실패 (에이전트 오류)`)
  } else if (!result.committed) {
    log(`⚠️ ${subtask.title} 커밋 실패`)
  }
  builds.push({ subtask, result })
}

const successfulBuilds = builds.filter((b) => b.result !== null)
log(`구현 완료: ${successfulBuilds.length}/${plan.subtasks.length}`)

// ─── Phase 3: Review (병렬, 텍스트 검토) ───────────────────────────────────────
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

// ─── Phase 4: Fix (순차 — 공유 트리를 수정하므로) ──────────────────────────────
phase('Fix')

let toFix = validReviews.filter((r) => r.review && !r.review.pass)
const fixedPassed = []
let attempt = 0

while (toFix.length > 0 && attempt < 2) {
  attempt++
  log(`Fix 시도 ${attempt}/2: ${toFix.length}개 항목 재작업`)
  const remaining = []

  for (const item of toFix) {
    const fixResult = await agent(
      `이전 구현에서 리뷰 실패가 발생했습니다. 피드백을 반영하여 재구현하세요.

태스크 제목: ${item.subtask.title}
원래 구현 지시:
${item.subtask.prompt}

리뷰 피드백:
${item.review.feedback}

발견된 문제점:
${item.review.issues.join('\n')}

위 문제점을 모두 수정하여 완전한 구현을 제공하세요. 이미 통합 브랜치에 커밋된 이전 구현을 수정/보완하면 된다.${buildEnv}`,
      {
        agentType: item.subtask.agentType,
        label: `fix:${item.subtask.title}:attempt${attempt}`,
        phase: 'Fix',
        schema: BUILD_SCHEMA,
      }
    )

    const review = fixResult
      ? await agent(
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
        )
      : null

    if (fixResult) item.result = fixResult
    if (review) item.review = review

    if (review && review.pass) {
      fixedPassed.push(item)
    } else {
      remaining.push(item)
    }
  }

  toFix = remaining
}

// ─── Phase 5: Integrate (단일 브랜치 검증 + push + PR) ──────────────────────────
// 모든 빌드가 같은 브랜치에 순차 커밋했으므로 병합이 필요 없다 → add/add 충돌 없음.
phase('Integrate')

const initialPassed = validReviews.filter((r) => r.review && r.review.pass)
const stillFailed = toFix
const totalPassed = initialPassed.length + fixedPassed.length
const anyCommitted = successfulBuilds.some((b) => b.result && b.result.committed)

let integration = null

if (!anyCommitted) {
  log('통합 브랜치에 커밋된 변경이 없습니다. Integrate 단계를 건너뜁니다.')
} else {
  log(`통합 시작: ${branchName} 검증 → push → PR`)

  integration = await agent(
    `너는 메인 git working tree, 통합 브랜치 \`${branchName}\` 에서 동작한다(빌드 에이전트들이 여기에 순차 커밋해 두었다). 아래 절차를 정확히 수행해라.

목표: 통합 브랜치를 타입 검사 후 원격에 push하고 PR을 생성한다. (브랜치 병합 작업은 필요 없다 — 단일 브랜치다.)

통합 브랜치: ${branchName}
${issueRef ? `관련 이슈 번호: #${issueRef}` : '(관련 이슈 없음 — 단독 실행)'}
${stillFailed.length ? `리뷰 미통과 항목(PR 본문에 명시할 것): ${stillFailed.map((r) => r.subtask.title).join(', ')}` : '모든 항목 리뷰 통과.'}

절차:
1. \`git checkout ${branchName}\` 로 통합 브랜치에 있는지 확인한다(이미 거기 있을 것). 커밋 안 된 변경이 남아 있으면 \`git add -A && git commit -m "chore: 통합 정리"\` 로 커밋한다.
2. \`pnpm install --frozen-lockfile=false\` 후 \`pnpm tsc\` 로 타입 검사. 실패하면 가능한 범위에서 수정 후 다시 검사하고, 수정분은 커밋한다.
3. tsc가 통과하면 \`git push -u origin ${branchName}\` 로 푸시한다.
4. \`gh pr create --base master --head ${branchName} --title "..." --body "..."\` 로 PR을 만든다.${issueRef ? ` PR 본문에 "Closes #${issueRef}" 를 포함한다.` : ''}${stillFailed.length ? ' 리뷰 미통과 항목을 PR 본문에 "미해결 리뷰 항목" 으로 명시한다.' : ''}
5. gh가 출력한 PR URL을 prUrl로 반환한다. push/PR에 실패하면 pushed=false로 두고 notes에 원인을 적는다.
6. 성공/실패와 무관하게, 마지막에 반드시 \`git checkout master\` 로 master 브랜치에 복귀한다. 후속 작업이 엉뚱한 브랜치에 얹히지 않도록 하는 필수 단계다.

환경변수 GITHUB_TOKEN / GITHUB_REPO 와 인증된 gh CLI 를 사용할 수 있다.

반환값(JSON): integrationBranch, tscPassed, pushed, prUrl(없으면 빈 문자열), notes.`,
    {
      agentType: 'backend-dev',
      label: 'integrate',
      phase: 'Integrate',
      schema: INTEGRATE_SCHEMA,
    }
  )

  if (integration) {
    log(
      `통합 결과: tsc ${integration.tscPassed ? '통과' : '실패'}, ` +
        `${integration.pushed ? `PR: ${integration.prUrl || '(URL 없음)'}` : 'push 안 됨'}`
    )
  } else {
    log('통합 에이전트 실행 실패 (null 반환).')
  }
}

// ─── Phase 6: Report ─────────────────────────────────────────────────────────
phase('Report')

const totalFailed = stillFailed.length
log(`최종 결과: ${totalPassed} 통과 / ${totalFailed} 실패`)

return {
  summary:
    `${totalPassed} passed, ${totalFailed} failed (${plan.subtasks.length} total subtasks)` +
    (integration && integration.pushed && integration.prUrl ? ` — PR: ${integration.prUrl}` : ''),
  passed: initialPassed.map((r) => r.subtask.title),
  fixedAndPassed: fixedPassed.map((r) => r.subtask.title),
  failed: stillFailed.map((r) => ({
    title: r.subtask.title,
    issues: r.review ? r.review.issues : [],
    feedback: r.review ? r.review.feedback : '리뷰 데이터 없음',
  })),
  integration: integration
    ? {
        branch: integration.integrationBranch,
        tscPassed: integration.tscPassed,
        prUrl: integration.pushed ? integration.prUrl || null : null,
        notes: integration.notes,
      }
    : null,
}
