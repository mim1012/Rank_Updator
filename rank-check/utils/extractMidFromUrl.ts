/**
 * 네이버 쇼핑 상품 URL에서 MID(상품 ID)를 추출하는 유틸 함수
 *
 * 지원하는 URL 패턴:
 * 1. 스마트스토어: https://smartstore.naver.com/{storeId}/products/{MID}?...
 * 2. 브릿지 링크: https://cr3.shopping.naver.com/v2/bridge?nvMid={MID}&...
 * 3. 쇼핑 검색: https://search.shopping.naver.com/catalog/{MID}
 *
 * @param url - 네이버 쇼핑 상품 URL (쿼리 파라미터 포함 가능)
 * @returns MID(숫자 문자열) 또는 null
 */
export function extractMidFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // 패턴 1: smartstore.naver.com/*/products/{MID}
    if (urlObj.hostname.includes('smartstore.naver.com')) {
      const match = urlObj.pathname.match(/\/products\/(\d+)/);
      return match ? match[1] : null;
    }

    // 패턴 2: cr3.shopping.naver.com (nvMid 파라미터)
    if (urlObj.hostname.includes('cr3.shopping')) {
      return urlObj.searchParams.get('nvMid');
    }

    // 패턴 3: search.shopping.naver.com/catalog/{MID}
    if (urlObj.hostname.includes('search.shopping.naver.com')) {
      const match = urlObj.pathname.match(/\/catalog\/(\d+)/);
      return match ? match[1] : null;
    }

    // 지원하지 않는 URL 형식
    return null;
  } catch (error) {
    // URL 파싱 실패
    return null;
  }
}

/**
 * URL에서 MID를 추출하고 결과를 콘솔에 출력하는 테스트 함수
 */
export function testExtractMid(url: string): void {
  console.log(`\nURL: ${url}`);
  const mid = extractMidFromUrl(url);
  if (mid) {
    console.log(`✅ MID: ${mid}`);
  } else {
    console.log(`❌ MID를 추출할 수 없습니다`);
  }
}
