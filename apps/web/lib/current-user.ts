// 인증 미도입 MVP용 고정 사용자 ID.
// 추후 인증 도입 시 세션에서 user_id를 추출하는 함수로 교체한다.
export const LOCAL_USER_ID = 'local-user'

// 호출부가 인증 도입 후에도 인터페이스를 유지하도록 함수로 래핑.
export function getCurrentUserId(): string {
  return LOCAL_USER_ID
}
