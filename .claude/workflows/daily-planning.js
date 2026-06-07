export const meta = {
  name: 'daily-planning',
  description: 'PM이 GitHub Issues를 분석해 오늘 할 작업을 결정하고, 대장(implement-feature)에게 위임. 판단 불가 시 DB에 질문 저장 후 종료.',
  phases: [
    { title: 'Morning Brief', detail: 'PM이 GitHub Issues 읽고 오늘 태스크 판단' },
    { title: 'Execute', detail: 'implement-feature 워크플로우로 태스크 위임' },
    { title: 'EOD Report', detail: '오늘 완료/실패 요약' },
  ],
}

const PM_RESULT_SCHEMA = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['ready', 'needs_clarification'] },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['issueNumber', 'title', 'agentType', 'prompt', 'priority'],
        properties: {
          issueNumber: { type: 'number' },
          title: { type: 'string' },
          agentType: { type: 'string', enum: ['backend-dev', 'frontend-dev', 'api-specialist'] },
          prompt: { type: 'string' },
          priority: { type: 'number' },
        },
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['issueNumber', 'title', 'question', 'options'],
        properties: {
          issueNumber: { type: 'number' },
          title: { type: 'string' },
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

// Phase 1: PM이 GitHub Issues 읽고 오늘 태스크 결정
phase('Morning Brief')
log('PM이 GitHub Issues를 분석합니다...')

const pmResult = await agent(
  `오늘(${args && args.date ? args.date : 'today'}) 작업할 GitHub Issues를 분석해줘.

  환경변수 GITHUB_REPO에서 레포지토리명을 읽고, GITHUB_TOKEN으로 인증해서
  https://api.github.com/repos/{GITHUB_REPO}/issues?state=open&labels=backlog 를 WebFetch로 조회해.

  ${args && args.answers ? `사용자가 이전 질문에 다음과 같이 답변했어: ${JSON.stringify(args.answers)}. 이 답변을 바탕으로 작업 목록을 결정해줘.` : ''}

  판단 기준에 따라 오늘 진행 가능한 태스크를 선택하거나, 모호한 경우 questions를 반환해줘.`,
  { agentType: 'pm', schema: PM_RESULT_SCHEMA, label: 'pm:morning-brief', phase: 'Morning Brief' }
)

if (!pmResult) {
  log('PM 에이전트 실행 실패. 오늘 작업을 중단합니다.')
  return { status: 'error', message: 'PM agent failed' }
}

// 판단 불가: DB에 저장하고 종료
if (pmResult.status === 'needs_clarification') {
  log(`질문 ${pmResult.questions.length}개 발견. DB에 저장하고 사용자 확인을 기다립니다.`)

  await agent(
    `다음 질문들을 PostgreSQL pm_decisions 테이블에 저장해줘.

    run_date: 오늘 날짜
    questions: ${JSON.stringify(pmResult.questions)}
    status: 'pending'

    DATABASE_URL 환경변수로 연결. psql 명령어 또는 node -e로 INSERT 실행.
    저장 후 확인 메시지 출력.`,
    { agentType: 'backend-dev', label: 'save-decisions', phase: 'Morning Brief' }
  )

  log('질문이 DB에 저장되었습니다. /admin/pm 페이지에서 확인하세요.')
  return {
    status: 'needs_clarification',
    message: `${pmResult.questions.length}개 질문이 DB에 저장되었습니다. /admin/pm 에서 답변 후 워크플로우가 재시작됩니다.`,
    questions: pmResult.questions,
  }
}

// Phase 2: 태스크 실행 (implement-feature 워크플로우 위임)
phase('Execute')
const tasks = pmResult.tasks || []
log(`오늘 태스크 ${tasks.length}개 실행 시작`)

const results = []
for (const task of tasks) {
  log(`[#${task.issueNumber}] ${task.title} 시작...`)
  const result = await workflow('implement-feature', { task: task.prompt })
  results.push({ task, result })
  log(`[#${task.issueNumber}] ${task.title} 완료`)
}

// Phase 3: EOD 리포트
phase('EOD Report')
const passed = results.filter(r => r.result && r.result.summary)
const failed = results.filter(r => !r.result || !r.result.summary)

log(`오늘 결과: 성공 ${passed.length}개, 실패 ${failed.length}개`)

return {
  status: 'done',
  date: args && args.date ? args.date : 'today',
  summary: {
    total: tasks.length,
    passed: passed.length,
    failed: failed.length,
  },
  completed: passed.map(r => ({ issueNumber: r.task.issueNumber, title: r.task.title })),
  failed: failed.map(r => ({ issueNumber: r.task.issueNumber, title: r.task.title })),
}
