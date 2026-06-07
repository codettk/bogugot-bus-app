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
  predictTime1: number
  predictTime2: number
  remainSeatCnt1: number
  remainSeatCnt2: number
  lowPlate1: boolean
  lowPlate2: boolean
}
