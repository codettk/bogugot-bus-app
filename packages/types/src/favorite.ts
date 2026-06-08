// 즐겨찾기 공유 타입
//
// 주의: favorites 테이블은 snake_case 컬럼(user_id, reference_id, created_at)을 사용한다.
// 아래 타입들은 클라이언트 친화적인 camelCase로 정의하며,
// 실제 snake_case ↔ camelCase 매핑(별칭 SELECT)은 API Route subtask에서 처리한다.
//   - user_id      → userId
//   - reference_id → referenceId
//   - created_at   → createdAt

// favorites 테이블의 type 컬럼 CHECK 제약: ('bus','stop','route')
// MVP 범위는 'route'/'stop'이지만, 테이블 CHECK 제약에 'bus'가 포함되어 있으므로 세 값 모두 포함한다.
export type FavoriteType = 'bus' | 'stop' | 'route'

// DB 행을 그대로 반영한 응답 타입
export interface Favorite {
  id: number
  userId: string // DB: user_id
  type: FavoriteType
  referenceId: string // DB: reference_id (노선ID 또는 정류장ID)
  label: string | null
  createdAt: string // DB: created_at (ISO 문자열)
}

// POST /api/favorites 요청 바디
export interface CreateFavoriteInput {
  type: FavoriteType
  referenceId: string
  label?: string
}
