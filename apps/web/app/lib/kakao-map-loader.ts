const KAKAO_SDK_SCRIPT_ID = 'kakao-map-sdk';

/**
 * 동시 호출 시 단일 Promise를 공유하기 위한 모듈 스코프 캐시.
 * 중복 로드를 방지한다.
 */
let loaderPromise: Promise<typeof window.kakao> | null = null;

/**
 * 카카오맵 SDK를 클라이언트에서 동적으로 1회 로드한다.
 * NEXT_PUBLIC_KAKAO_MAP_APP_KEY 환경변수를 사용한다.
 */
export function loadKakaoMapSdk(): Promise<typeof window.kakao> {
  // 이미 로드 완료된 경우 즉시 resolve.
  if (typeof window !== 'undefined' && window.kakao && window.kakao.maps) {
    return Promise.resolve(window.kakao);
  }

  // 이미 로딩 중이면 동일한 Promise를 공유한다.
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise<typeof window.kakao>((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

    if (!key) {
      loaderPromise = null;
      reject(new Error('NEXT_PUBLIC_KAKAO_MAP_APP_KEY가 설정되지 않았습니다.'));
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      loaderPromise = null;
      reject(new Error('카카오맵 SDK는 브라우저 환경에서만 로드할 수 있습니다.'));
      return;
    }

    const handleLoad = (): void => {
      // autoload=false 이므로 maps.load 로 명시적 초기화가 필요하다.
      window.kakao.maps.load(() => {
        resolve(window.kakao);
      });
    };

    const handleError = (): void => {
      loaderPromise = null;
      reject(new Error('카카오맵 SDK 로드에 실패했습니다.'));
    };

    const existing = document.getElementById(
      KAKAO_SDK_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    // 스크립트 태그가 이미 있으면 중복 주입하지 않고 로드 이벤트만 연결한다.
    if (existing) {
      if (window.kakao && window.kakao.maps) {
        handleLoad();
        return;
      }
      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_SDK_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=clusterer`;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return loaderPromise;
}
