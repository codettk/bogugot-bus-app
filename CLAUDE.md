# bogugot-bus-app

경기도 버스 공공 OpenAPI 기반 실시간 버스 추적 앱.
버스 위치 실시간 지도 표시, 정류장 도착 예상, 노선 검색, 즐겨찾기/알림 기능 제공.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 웹 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| 모바일 | React Native + Expo SDK 51 |
| 모노레포 | Turborepo 2 + pnpm workspaces |
| 지도 | Kakao Maps SDK (web), react-native-maps (mobile) |
| 실시간 | SSE (Server-Sent Events) |
| DB | PostgreSQL 16 + Redis 7 (Docker) |
| 상태 관리 | Zustand + TanStack Query v5 |
| 알림 | Firebase Cloud Messaging |
| 패키지 매니저 | pnpm 10 |
| Node | v20 |

## 모노레포 구조

```
bogugot-bus-app/
├── apps/
│   ├── web/                        # Next.js 14 웹앱
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── pm/             # PM 자동화 API
│   │   │   │       ├── decisions/  # GET 오늘 질문 조회
│   │   │   │       ├── decisions/[id]/answer/  # POST 답변 제출
│   │   │   │       └── trigger/    # POST Claude CLI 재실행
│   │   │   ├── admin/
│   │   │   │   └── pm/             # 관리자 페이지 (/admin/pm)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── lib/
│   │   │   └── db.ts               # PostgreSQL 풀 (pg.Pool)
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   └── mobile/                     # Expo SDK 51 모바일 앱
│       ├── app/
│       │   ├── _layout.tsx
│       │   └── index.tsx
│       └── app.json
├── packages/
│   ├── types/                      # 공유 TypeScript 타입 정의
│   │   └── src/
│   │       ├── bus.ts              # BusLocation, BusArrival
│   │       ├── stop.ts             # BusStop
│   │       ├── route.ts            # BusRoute
│   │       └── index.ts
│   ├── api-client/                 # 경기 버스 OpenAPI 클라이언트
│   │   └── src/
│   │       ├── client.ts           # gyeonggiApi (fetch 래퍼)
│   │       ├── cache.ts            # withCache(), CACHE_TTL
│   │       ├── errors.ts           # GyeonggiApiError, CacheError
│   │       └── index.ts
│   └── ui/                        # 공유 컴포넌트 라이브러리
│       └── src/
│           ├── LoadingSpinner.tsx
│           ├── ErrorMessage.tsx
│           └── index.ts
├── scripts/
│   ├── init-db.sql                 # Docker 초기 DB 스키마 (자동 실행)
│   └── morning-run.ps1             # Windows 작업 스케줄러용 7AM 실행 스크립트
├── .claude/
│   ├── settings.json
│   ├── agents/                     # Claude Code 서브에이전트 페르소나
│   │   ├── pm.md                   # PM: GitHub Issues 읽고 오늘 태스크 결정
│   │   ├── planning-pm.md          # 스프린트 플래너: 코드 분석 → 다음 이슈 제안
│   │   ├── architect.md            # 기능 분해 및 인터페이스 설계
│   │   ├── backend-dev.md          # API Route, DB, Redis, SSE
│   │   ├── frontend-dev.md         # 웹/모바일 UI, 상태 관리
│   │   ├── api-specialist.md       # 경기 버스 OpenAPI 클라이언트
│   │   └── reviewer.md             # 타입 안전성, 보안, 성능 검사
│   └── workflows/
│       ├── implement-feature.js    # 기능 구현 → 검사 → 재작업 오케스트레이션
│       ├── daily-planning.js       # PM → 구현 → 이슈 close → planning 전체 파이프라인
│       └── planning.js             # 코드 분석 → 갭 파악 → 이슈 자동 생성/업데이트
├── docker-compose.yml              # PostgreSQL 16 + Redis 7
├── tsconfig.base.json              # 공통 TypeScript 설정 (strict: true)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json                    # 루트 (packageManager: pnpm@10.34.1)
```

## PM 자동화 시스템

매일 7AM Windows 작업 스케줄러가 `scripts/morning-run.ps1`을 실행합니다.

```
[작업 스케줄러 - 7AM]
  → morning-run.ps1
  → claude -p "/daily-planning" --dangerously-skip-permissions
          ↓
  [PM 에이전트] GitHub Issues 읽기 + 우선순위 판단
          ↓
    판단 가능                        판단 불가
          ↓                               ↓
  implement-feature              DB(pm_decisions)에 질문 저장
  (분해→구현→리뷰→통합→PR)        워크플로우 종료
          ↓                               ↓
  구현 성공: 통합 브랜치 머지+tsc    사용자: http://localhost:3000/admin/pm
   → PR 생성 + 이슈에 PR 링크 코멘트   질문 확인 → 답변 선택 → 제출
   (이슈는 open 유지, PR 머지 시            ↓
    Closes 키워드로 자동 close)      POST /api/pm/trigger
  구현 실패: 이슈에 실패 코멘트       → Claude CLI 재실행 → 작업 시작
   (이슈 open 유지, 다음날 재시도)
          ↓
  [planning 워크플로우]
  코드 현황 분석 → 열린 이슈 조회
  갭 분석 → 신규 이슈 생성/업데이트 (최대 5개, 중복 방지)
          ↓
  worktree 정리 (git worktree prune + 폴더/브랜치 삭제)
```

> 구현 코드는 **master에 직접 머지하지 않고 PR로 올립니다**(사람 검토용). PR 본문에 `Closes #N`이 포함되어 머지 시 이슈가 자동으로 닫힙니다.
> `isolation: 'worktree'`로 만든 격리 작업트리는 변경이 있으면 자동 삭제되지 않으므로, morning-run.ps1 끝에서 일괄 정리합니다(`.claude/worktrees/`는 `.gitignore` 처리됨).

### GitHub Issues 백로그 규칙

PM이 읽을 이슈에는 반드시 다음 라벨을 붙입니다:
- `backlog` — PM이 매일 조회하는 기본 라벨
- `priority:high` / `priority:medium` / `priority:low` — 우선순위
- `in_progress` — 작업 중 (PM이 건너뜀)

### 이슈 자동 처리 규칙

- 구현 **성공** 시: 통합 브랜치 머지 + `pnpm tsc` 통과 → **PR 생성**(`Closes #N` 포함) → 이슈에 PR 링크 코멘트 추가 → 이슈는 **`open` 유지**(PR 머지 시 자동 close)
- 구현 **실패** 시: 이슈에 실패 내용 코멘트 추가 → 이슈 `open` 유지 (다음날 재시도)
- 매일 작업 종료 후 `planning` 워크플로우가 자동 실행되어 다음 스프린트 이슈를 보충
- `planning`이 생성하는 신규 이슈에는 **반드시 `backlog` + `priority:*` 라벨**을 붙여야 PM이 다음 사이클에 집어들 수 있음 (라벨 누락 시 자동 루프가 끊김)

### GitHub 연동 규칙 (gh CLI)

워크플로우/에이전트가 GitHub와 상호작용할 때:

- **조회(GET)**: `WebFetch`로 `https://api.github.com/...` 호출 가능 (PM의 이슈 읽기 등)
- **쓰기(코멘트/이슈 생성/라벨/close/PR)**: 반드시 **인증된 `gh` CLI**를 `Bash`로 사용
  - ❌ `WebFetch`로 인증 POST/PATCH 금지 — 인증 본문을 신뢰성 있게 보내지 못해 **조용히 누락/실패**함 (코멘트 안 달림, 라벨 빠짐 등)
  - ✅ `gh issue comment N --body-file <파일>`, `gh issue create --title ... --body-file ... --label backlog --label priority:medium`, `gh pr create --base master --head <branch>`
  - 긴 본문은 셸 인용 문제를 피하려 임시 파일 + `--body-file` 사용
  - 쓰기 작업은 `Bash`를 가진 에이전트(`backend-dev`)에 할당 (`reviewer`/`architect`/`planning-pm`은 Bash 없음)
- `implement-feature`의 통합 단계는 작업 후 **반드시 `git checkout master`로 복귀** (feature 브랜치에 남으면 이후 커밋이 엉뚱한 곳에 얹힘)
- 자동화 실행 전 **로컬 `master`가 `origin`과 동기화**돼 있어야 함 — 빌드 worktree가 로컬 master에서 갈라지므로, push 안 한 로컬 커밋이 있으면 모든 PR diff에 섞여 들어감

## 경기 버스 OpenAPI 규칙

- **기본 URL**: `https://apis.data.go.kr/6410000` (공공데이터포털, `6410000`은 경기도청 기관코드)
- **키 발급**: [data.go.kr](https://www.data.go.kr) 로그인 → "경기도 버스" 검색 → 활용신청 (자동승인)
- **API 키**: 환경변수 `GYEONGGI_BUS_API_KEY` (절대 코드에 하드코딩 금지)
- **일일 호출 제한** 개발계정 1,000건/일 → Redis 캐시 필수
- **모든 호출은 `packages/api-client`를 통해서만** — 직접 fetch 금지

### 엔드포인트 구조

```
https://apis.data.go.kr/6410000/{서비스명}/v2/{오퍼레이션}v2
```

| 기능 | 엔드포인트 | 파라미터 | 응답 키 |
|------|-----------|---------|--------|
| 버스 위치 | `/buslocationservice/v2/getBusLocationListv2` | `routeId` | `busLocationList` |
| 도착 정보 | `/busarrivalservice/v2/getBusArrivalListv2` | `stationId` | `busArrivalList` |
| 정류장 검색 | `/busstationservice/v2/getBusStationListv2` | `keyword` | `busStationList` |
| 노선 검색 | `/busrouteservice/v2/getBusRouteListv2` | `keyword` | `busRouteList` |

### API 응답 구조

```json
{
  "response": {
    "msgHeader": { "resultCode": 0, "resultMessage": "정상적으로 처리되었습니다." },
    "msgBody": { "busLocationList": [...] }
  }
}
```

`resultCode !== 0`이면 `GyeonggiApiError` 발생. `packages/api-client`의 `fetchApi()`가 자동 처리.

### 캐시 TTL 정책 (절대 변경 금지)

| 데이터 | TTL | Redis 키 패턴 |
|--------|-----|---------------|
| 버스 위치 | **10초** | `bus:location:{busId}` |
| 정류소 정보 | **1시간 (3600초)** | `stop:info:{stopId}` |
| 노선 정보 | **1시간 (3600초)** | `route:info:{routeId}` |

### 환경변수 목록

```bash
GYEONGGI_BUS_API_KEY=        # 경기도 OpenAPI 키 (data.go.kr 발급, URL 디코딩된 원본값 사용)
DATABASE_URL=postgresql://bogugot:bogugot1234@localhost:5432/bogugot
REDIS_URL=redis://localhost:6379
KAKAO_MAP_APP_KEY=            # 카카오맵 앱 키
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
GOOGLE_APPLICATION_CREDENTIALS=./bogugot-bus-app-firebase-adminsdk-fbsvc-*.json  # Firebase Admin SDK
FCM_SERVER_KEY=               # Firebase Cloud Messaging 서버 키 (알림 기능 시 필요)
GITHUB_TOKEN=                 # Fine-grained token (Issues: Read & Write)
GITHUB_REPO=codettk/bogugot-bus-app
```

> `GYEONGGI_BUS_API_KEY`는 URL 인코딩된 값(`%2B`, `%3D`)이 아닌 원본(`+`, `=`)으로 저장. `url.searchParams.set()`이 자동 인코딩함.

## DB 스키마 (현재 생성된 테이블)

```sql
-- PM 자동화: 질문 대기 테이블
pm_decisions (id, run_date, questions JSONB, answers JSONB, status, created_at, answered_at)

-- 버스 앱 핵심 기능
favorites (id, user_id, type, reference_id, label, created_at)
```

## 에이전트 책임 분리

Claude Code 멀티에이전트 하네스(`.claude/agents/`)를 사용할 때 아래 책임 분리를 따름:

| 에이전트 | 역할 | 담당 경로 |
|----------|------|-----------|
| `pm` | GitHub Issues 읽기, 오늘 태스크 결정, 판단 불가 시 DB 저장 | 전체 (읽기만) |
| `planning-pm` | 코드베이스 분석, 갭 파악, 다음 스프린트 이슈 제안 (신규/업데이트) | 전체 (읽기만) |
| `architect` | 기능 분해 및 인터페이스 설계 | 전체 (설계만, 구현 없음) |
| `backend-dev` | API Route, DB 스키마, Redis 캐시, SSE | `apps/web/app/api/`, `apps/web/lib/` |
| `frontend-dev` | 웹/모바일 UI, 상태 관리, 지도 | `apps/web/app/`, `apps/mobile/`, `packages/ui/` |
| `api-specialist` | 경기 버스 OpenAPI 클라이언트 | `packages/api-client/` |
| `reviewer` | 타입 안전성, 보안, 성능, 컨벤션 검사 | 전체 (검사만, 수정 없음) |

## 코드 컨벤션

### TypeScript
- `strict: true` 필수 — `any` 사용 금지, `unknown` 사용
- 공유 타입은 반드시 `packages/types`에 정의 후 import
- API 응답 타입은 `packages/api-client`에서 export
- `tsconfig.base.json` 상속 후 패키지별 확장

### 파일명
- 모든 파일: `kebab-case.ts` (PascalCase는 React 컴포넌트 파일만 허용)
- Next.js 특수 파일: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx` 등 프레임워크 규칙 따름

### Next.js App Router
- 기본적으로 Server Component 사용
- `'use client'`는 상태/이벤트 핸들러가 필요한 최소 범위에만 적용
- 데이터 fetching은 Server Component에서 직접 또는 Server Action 사용
- SSE 엔드포인트: `Response` with `ReadableStream` 반환
- DB 접근: `apps/web/lib/db.ts`의 `db.query()` 사용

### Redis 캐시 패턴
```typescript
import { withCache, CACHE_TTL } from '@bogugot/api-client'

const data = await withCache(redis, `bus:location:${busId}`, CACHE_TTL.BUS_LOCATION, () =>
  gyeonggiApi.getBusLocations(busId)
)
```

### 금지 패턴
- `console.log` 프로덕션 코드에 사용 금지 (개발 중만 허용)
- API 키/시크릿 환경변수 없이 코드에 직접 작성 금지
- `packages/api-client` 우회하여 외부 API 직접 호출 금지
- SQL 문자열 연결 금지 — 파라미터 바인딩(`$1`, `$2`) 필수

## 로컬 개발

### 선행 조건

```powershell
# 1. Docker 컨테이너 시작 (PostgreSQL + Redis)
docker compose up -d

# 2. 의존성 설치
pnpm install

# 3. .env 파일 확인 (루트에 존재해야 함)
# .env.example 참고
```

### 개발 명령

```bash
# 전체 개발 서버 시작
pnpm dev

# 웹만 개발
pnpm --filter web dev

# 모바일만 개발 (Expo Go 앱 필요)
pnpm --filter mobile start

# 빌드
pnpm build

# 타입 체크
pnpm tsc

# 린트
pnpm lint
```

### 관리자 페이지

```
http://localhost:3000/admin/pm    # PM 질문 확인 및 답변
```

## Claude Code 워크플로우 사용법

```bash
# 기능 구현 (분해 → 구현 → 리뷰 → 재작업)
/implement-feature "버스 위치 SSE 엔드포인트 구현"

# PM 수동 실행 (GitHub Issues 기반 오늘 작업 자동 판단 → 구현 → 이슈 close → planning)
/daily-planning

# 스프린트 계획만 단독 실행 (코드 분석 → 다음 이슈 자동 생성/업데이트)
/planning

# 매일 7AM 자동 실행 (Windows 작업 스케줄러 등록 완료)
# scripts/morning-run.ps1 참고
```

> `isolation: 'worktree'` 사용으로 인해 `git init` + remote 설정 필수.
