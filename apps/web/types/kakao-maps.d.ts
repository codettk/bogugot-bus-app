/**
 * Kakao Maps JavaScript SDK 최소 전역 타입 선언.
 *
 * 프로젝트가 사용하는 멤버만 선언한다 (strict: true, any 금지).
 * 생성자 반환 객체는 각각 interface 로 노출하여 다른 파일에서
 * import 없이 전역으로 참조할 수 있게 한다.
 */

/** kakao.maps.LatLng 인스턴스 */
interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

/** kakao.maps.LatLngBounds 인스턴스 */
interface KakaoLatLngBounds {
  /** 좌표를 경계에 포함시켜 영역을 확장한다. */
  extend(latlng: KakaoLatLng): void
}

/** kakao.maps.Map 생성 옵션 */
interface KakaoMapOptions {
  center: KakaoLatLng
  level: number
}

/** kakao.maps.Map 인스턴스 */
interface KakaoMap {
  /** 지정한 경계가 모두 보이도록 지도 영역을 맞춘다. */
  setBounds(bounds: KakaoLatLngBounds): void
  /** 지도 중심 좌표를 이동한다. */
  setCenter(latlng: KakaoLatLng): void
  /** 현재 지도 중심 좌표를 반환한다. */
  getCenter(): KakaoLatLng
  /** 지도 확대 레벨을 설정한다. */
  setLevel(level: number): void
  /** 현재 지도 확대 레벨을 반환한다. */
  getLevel(): number
}

/** kakao.maps.Marker 생성 옵션 */
interface KakaoMarkerOptions {
  position: KakaoLatLng
  title?: string
  map?: KakaoMap
}

/** kakao.maps.Marker 인스턴스 */
interface KakaoMarker {
  /** 마커 위치를 변경한다. */
  setPosition(latlng: KakaoLatLng): void
  /** 마커를 지도에 올리거나(map), 제거한다(null). */
  setMap(map: KakaoMap | null): void
}

/** kakao.maps.InfoWindow 생성 옵션 (마커 라벨 표시용, 선택) */
interface KakaoInfoWindowOptions {
  content: string | HTMLElement
  position?: KakaoLatLng
  removable?: boolean
}

/** kakao.maps.InfoWindow 인스턴스 (선택) */
interface KakaoInfoWindow {
  /** 지정한 지도/마커 위에 인포윈도우를 연다. */
  open(map: KakaoMap, marker?: KakaoMarker): void
  /** 인포윈도우를 닫는다. */
  close(): void
}

declare namespace kakao.maps {
  /**
   * SDK 가 autoload=false 로 로드된 경우, 사용 준비가 되면 콜백을 실행한다.
   */
  function load(callback: () => void): void

  /** 위경도 좌표 객체 생성자. */
  class LatLng implements KakaoLatLng {
    constructor(lat: number, lng: number)
    getLat(): number
    getLng(): number
  }

  /** 좌표 경계 객체 생성자. */
  class LatLngBounds implements KakaoLatLngBounds {
    constructor()
    extend(latlng: KakaoLatLng): void
  }

  /** 지도 객체 생성자. */
  class Map implements KakaoMap {
    constructor(container: HTMLElement, options: KakaoMapOptions)
    setBounds(bounds: KakaoLatLngBounds): void
    setCenter(latlng: KakaoLatLng): void
    getCenter(): KakaoLatLng
    setLevel(level: number): void
    getLevel(): number
  }

  /** 마커 객체 생성자. */
  class Marker implements KakaoMarker {
    constructor(options: KakaoMarkerOptions)
    setPosition(latlng: KakaoLatLng): void
    setMap(map: KakaoMap | null): void
  }

  /** 인포윈도우 객체 생성자 (선택, 마커 라벨용). */
  class InfoWindow implements KakaoInfoWindow {
    constructor(options: KakaoInfoWindowOptions)
    open(map: KakaoMap, marker?: KakaoMarker): void
    close(): void
  }
}

/**
 * kakao 전역 네임스페이스 타입 별칭.
 * SDK 로드 후 resolve 되는 객체 타입을 import 없이 전역 참조할 수 있게 한다.
 */
type KakaoNamespace = typeof kakao

// 파일에 import/export 가 없어 ambient(전역) 스크립트로 취급되므로,
// 위 namespace/interface 들은 다른 파일에서 import 없이 전역 참조 가능하다.
// Window 인터페이스도 전역 병합된다. SDK 로드 전에는 undefined 이므로 optional.
interface Window {
  kakao?: KakaoNamespace
}
