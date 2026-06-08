// Kakao Maps JavaScript SDK 최소 타입 선언
// (공식 @types 패키지가 없어 BusMap 에서 사용하는 부분만 정의 — any 회피 목적)

interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void
  getCenter(): KakaoLatLng
  setLevel(level: number): void
  getLevel(): number
}

interface KakaoMarker {
  setMap(map: KakaoMap | null): void
  setPosition(latlng: KakaoLatLng): void
  setTitle(title: string): void
}

interface KakaoMarkerOptions {
  position: KakaoLatLng
  map?: KakaoMap
  title?: string
}

interface KakaoMapOptions {
  center: KakaoLatLng
  level?: number
}

interface KakaoMapsNamespace {
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap
  Marker: new (options: KakaoMarkerOptions) => KakaoMarker
  load(callback: () => void): void
}

interface KakaoNamespace {
  maps: KakaoMapsNamespace
}

interface Window {
  kakao?: KakaoNamespace
}
