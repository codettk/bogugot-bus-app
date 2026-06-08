/**
 * 카카오맵 SDK 전역 타입 선언.
 * 이 앱에서 실제 사용하는 최소 표면만 선언한다. (any 금지)
 */

declare namespace kakao.maps {
  /** 위경도 좌표 */
  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  /** 지도 생성 옵션 */
  interface MapOptions {
    center: LatLng;
    level: number;
  }

  /** 지도 인스턴스 */
  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    setLevel(level: number): void;
  }

  /** 마커 생성 옵션 */
  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    title?: string;
  }

  /** 마커 인스턴스 */
  class Marker {
    constructor(options: MarkerOptions);
    setPosition(latlng: LatLng): void;
    setMap(map: Map | null): void;
  }

  /**
   * autoload=false 로 로드한 경우, SDK 사용 전 호출해야 하는 초기화 함수.
   * 콜백은 maps 모듈 로딩 완료 후 실행된다.
   */
  function load(callback: () => void): void;
}

declare global {
  interface Window {
    kakao: typeof kakao;
  }
}

export {};
