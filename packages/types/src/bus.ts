export interface BusLocation {
  busId: string
  routeId: string
  plateNo: string
  latitude: number
  longitude: number
  lowFloor: boolean
  remainSeatCnt: number
  updatedAt: string
}

export interface BusArrival {
  busId: string
  routeId: string
  routeName: string
  /** 첫 번째 도착 예정 차량까지 남은 시간 (단위: 분) */
  predictTime1: number
  /** 두 번째 도착 예정 차량까지 남은 시간 (단위: 분) */
  predictTime2: number
  remainSeatCnt1: number
  remainSeatCnt2: number
  lowPlate1: boolean
  lowPlate2: boolean
  /** 첫 번째 차량 남은 정류장 수 (경기 OpenAPI 응답에 항상 존재하지는 않음) */
  locationNo1?: number
  /** 두 번째 차량 남은 정류장 수 (경기 OpenAPI 응답에 항상 존재하지는 않음) */
  locationNo2?: number
  /**
   * 첫 번째 차량 혼잡도 (경기 OpenAPI crowded 코드값)
   * 0=정보없음, 1=여유, 2=보통, 3=혼잡
   * 후속 컴포넌트에서 라벨 매핑에 사용
   */
  crowded1?: number
  /**
   * 두 번째 차량 혼잡도 (경기 OpenAPI crowded 코드값)
   * 0=정보없음, 1=여유, 2=보통, 3=혼잡
   */
  crowded2?: number
}
