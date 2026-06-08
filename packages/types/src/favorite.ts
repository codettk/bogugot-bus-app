// DB favorites 테이블 컬럼 (id, user_id, type, reference_id, label, created_at)에 매핑
// type은 'route' | 'stop'만 허용
export type FavoriteType = 'route' | 'stop'

export interface Favorite {
  id: number
  userId: string
  type: FavoriteType
  referenceId: string
  label: string
  createdAt: string // ISO 8601 문자열 (JSON 직렬화 결과)
}

// POST /api/favorites 요청 body 타입
export interface CreateFavoriteInput {
  type: FavoriteType
  referenceId: string
  label: string
}
