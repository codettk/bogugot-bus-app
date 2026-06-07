export const meta = {
  name: 'planning',
  description: '코드베이스와 열린 이슈를 분석해 다음 스프린트 이슈를 자동 생성/업데이트한다.',
  phases: [
    { title: 'Analyze', detail: '코드 현황 + 열린 이슈 수집' },
    { title: 'Plan', detail: 'planning-pm이 갭 분석 후 이슈 제안' },
    { title: 'Apply', detail: '제안 기반 이슈 생성/업데이트' },
  ],
}

const SUGGESTIONS_SCHEMA = {
  type: 'object',
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['create', 'update'] },
          title: { type: 'string' },
          body: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          labels: { type: 'array', items: { type: 'string' } },
          existingIssueNumber: { type: 'number' },
          existingTitle: { type: 'string' },
          additionalBody: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
}

// Phase 1: 현황 수집
phase('Analyze')
log('코드베이스 현황 및 열린 이슈 수집 중...')

const [codeState, openIssues] = await parallel([
  // 구현된 파일 현황
  () => agent(
    `bogugot-bus-app 코드베이스에서 현재 구현된 기능 현황을 파악해줘.

확인할 경로:
- apps/web/app/api/ (구현된 API Routes 목록)
- apps/web/app/ (페이지 및 컴포넌트)
- apps/mobile/app/ (모바일 화면)
- packages/ (공유 패키지)

각 경로에 어떤 파일이 있는지 목록을 만들고,
어떤 기능이 구현되어 있는지 간략히 설명해줘.
없는 경로는 "미구현"으로 표시.`,
    { label: 'analyze:codebase', phase: 'Analyze' }
  ),

  // 열린 이슈 전체 조회
  () => agent(
    `GitHub API로 열린 이슈 전체를 조회해줘.

GET https://api.github.com/repos/${process.env.GITHUB_REPO}/issues?state=open&per_page=50
Authorization: Bearer ${process.env.GITHUB_TOKEN}

WebFetch로 조회한 후, 각 이슈의 number, title, labels, body를 JSON 형식으로 반환해줘.`,
    { label: 'analyze:issues', phase: 'Analyze' }
  ),
])

log('현황 수집 완료')

// Phase 2: planning-pm이 이슈 제안
phase('Plan')
log('planning-pm이 다음 스프린트 이슈를 분석 중...')

const suggestions = await agent(
  `bogugot-bus-app의 다음 스프린트 이슈를 제안해줘.

## 현재 코드베이스 현황
${codeState}

## 현재 열린 이슈 목록
${openIssues}

## 프로젝트 환경변수 설정 현황
- GYEONGGI_BUS_API_KEY: 설정됨
- KAKAO_MAP_APP_KEY: 설정됨
- GOOGLE_APPLICATION_CREDENTIALS (Firebase): 설정됨
- FCM_SERVER_KEY: 미설정

위 정보를 바탕으로:
1. 이미 구현된 기능은 제안하지 말 것
2. 이미 열린 이슈와 동일/유사한 내용은 중복 생성하지 말고 update 액션으로 처리
3. 미설정 환경변수가 필요한 기능은 제안하지 말 것 (FCM 관련 제외)
4. 최대 5개까지만 제안`,
  { agentType: 'planning-pm', schema: SUGGESTIONS_SCHEMA, label: 'plan:suggestions', phase: 'Plan' }
)

if (!suggestions || suggestions.suggestions.length === 0) {
  log('새로 제안할 이슈가 없습니다. 현재 이슈가 충분합니다.')
  return { status: 'done', created: 0, updated: 0 }
}

log(`제안 ${suggestions.suggestions.length}개: ${suggestions.suggestions.map(s => s.action === 'create' ? `[신규] ${s.title}` : `[업데이트] #${s.existingIssueNumber}`).join(', ')}`)

// Phase 3: 이슈 생성/업데이트
phase('Apply')

const results = await parallel(
  suggestions.suggestions.map(suggestion => () => {
    if (suggestion.action === 'create') {
      const labels = suggestion.labels || ['backlog', `priority:${suggestion.priority || 'medium'}`]
      return agent(
        `GitHub API로 새 이슈를 생성해줘.

POST https://api.github.com/repos/${process.env.GITHUB_REPO}/issues
Authorization: Bearer ${process.env.GITHUB_TOKEN}
Content-Type: application/json

body:
{
  "title": ${JSON.stringify(suggestion.title)},
  "body": ${JSON.stringify(suggestion.body)},
  "labels": ${JSON.stringify(labels)}
}

WebFetch로 POST 요청 실행 후 생성된 이슈 번호를 반환해줘.`,
        { label: `apply:create:${suggestion.title}`, phase: 'Apply' }
      )
    } else {
      return agent(
        `GitHub API로 기존 이슈 #${suggestion.existingIssueNumber}에 코멘트를 추가해줘.

POST https://api.github.com/repos/${process.env.GITHUB_REPO}/issues/${suggestion.existingIssueNumber}/comments
Authorization: Bearer ${process.env.GITHUB_TOKEN}
Content-Type: application/json

body:
{
  "body": ${JSON.stringify(`## 📋 스프린트 플래너 업데이트\n\n**업데이트 이유:** ${suggestion.reason}\n\n${suggestion.additionalBody}`)}
}

WebFetch로 POST 요청 실행 후 성공 여부를 반환해줘.`,
        { label: `apply:update:${suggestion.existingIssueNumber}`, phase: 'Apply' }
      )
    }
  })
)

const created = suggestions.suggestions.filter(s => s.action === 'create').length
const updated = suggestions.suggestions.filter(s => s.action === 'update').length

log(`완료 — 신규 이슈 ${created}개 생성, 기존 이슈 ${updated}개 업데이트`)

return {
  status: 'done',
  created,
  updated,
  suggestions: suggestions.suggestions.map(s =>
    s.action === 'create'
      ? { action: 'create', title: s.title, priority: s.priority }
      : { action: 'update', issueNumber: s.existingIssueNumber, reason: s.reason }
  ),
}
