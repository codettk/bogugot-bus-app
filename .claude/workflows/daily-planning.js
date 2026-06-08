export const meta = {
  name: 'daily-planning',
  description: 'PM이 GitHub Issues를 분석해 오늘 할 작업을 결정하고, 대장(implement-feature)에게 위임. 판단 불가 시 DB에 질문 저장 후 종료.',
  phases: [
    { title: 'Morning Brief', detail: 'PM이 GitHub Issues 읽고 오늘 태스크 판단' },
    { title: 'Execute', detail: 'implement-feature 워크플로우로 태스크 위임' },
    { title: 'EOD Report', detail: '오늘 완료/실패 요약' },
    { title: 'Planning', detail: '다음 스프린트 이슈 생성/업데이트' },
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
  const result = await workflow('implement-feature', {
    task: task.prompt,
    issueNumber: task.issueNumber,
    title: task.title,
  })
  results.push({ task, result })

  // 구현 결과 판정: 실패 항목이 없고, 통합 단계에서 PR이 생성됐는지까지 본다.
  const noFailures = result && result.summary && !result.failed?.length
  const prUrl = result && result.integration ? result.integration.prUrl : null
  const success = noFailures && Boolean(prUrl)

  // 구현 코드는 PR로 올라가며 master에 자동 병합되지 않는다.
  // 따라서 성공해도 이슈를 닫지 않고 PR 링크만 코멘트한다(머지는 사람이 검토 후).
  let commentBody
  if (success) {
    commentBody = `## ✅ 구현 완료 — PR 생성됨 (머지 대기)\n\n${result.summary}\n\n**통과:** ${(result.passed || []).concat(result.fixedAndPassed || []).join(', ')}\n\n**PR:** ${prUrl}\n\n> 코드는 통합 브랜치 PR로 올라갔습니다. 검토 후 머지하면 이 이슈는 자동으로 닫힙니다(PR 본문 \`Closes #${task.issueNumber}\`).\n> 자동 처리 by bogugot PM`
  } else if (noFailures) {
    commentBody = `## ⚠️ 구현은 통과했으나 통합 실패\n\n${result.summary}\n\n통합/PR 단계에서 문제가 발생했습니다(타입 검사 실패 또는 push 실패).\n\n${result.integration ? `통합 메모: ${result.integration.notes}` : '통합 정보 없음'}\n\n> 자동 기록 by bogugot PM`
  } else {
    commentBody = `## ⚠️ 구현 부분 실패\n\n${result?.summary || '결과 없음'}\n\n**실패 항목:**\n${(result?.failed || []).map(f => `- ${f.title}: ${f.feedback}`).join('\n')}\n\n> 자동 기록 by bogugot PM`
  }

  // 코멘트만 남기고 이슈는 열어둔다(PR 머지 시 GitHub가 Closes 키워드로 자동 close).
  // 인증된 gh CLI를 Bash로 사용한다. (WebFetch는 인증 본문 POST를 신뢰성 있게 처리하지 못함)
  await agent(
    `인증된 gh CLI(Bash)를 사용해 이슈 #${task.issueNumber}에 코멘트를 추가해라.

절차:
1. 아래 코멘트 본문을 임시 파일에 쓴다(따옴표/줄바꿈 보존을 위해 --body-file 사용).
2. \`gh issue comment ${task.issueNumber} --body-file <임시파일>\` 실행.
3. 명령이 성공했는지(코멘트 URL 출력) 확인하고, 실패 시 원인을 보고한다.
4. 이슈 상태는 변경하지 마라 — PR 머지 시 Closes 키워드로 자동 close된다.

코멘트 본문:
---
${commentBody}
---`,
    { agentType: 'backend-dev', label: `comment-issue:${task.issueNumber}`, phase: 'Execute' }
  )

  log(`[#${task.issueNumber}] ${task.title} ${success ? `완료 (PR: ${prUrl})` : '미완료 (이슈 유지)'}`)
}

// Phase 3: EOD 리포트
phase('EOD Report')
const isSuccess = (r) =>
  r.result &&
  r.result.summary &&
  !r.result.failed?.length &&
  r.result.integration &&
  r.result.integration.prUrl
const passed = results.filter(isSuccess)
const failed = results.filter((r) => !isSuccess(r))

log(`오늘 결과: 성공(PR 생성) ${passed.length}개, 미완료 ${failed.length}개`)

// Phase 4: 다음 스프린트 계획 (planning 워크플로우)
phase('Planning')
log('다음 작업 계획 수립 중...')
await workflow('planning')

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
