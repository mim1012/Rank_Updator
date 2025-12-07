/**
 * 스마트스토어 URL에서 실제 Catalog MID(nvMid)를 추출
 *
 * 스마트스토어 상품 페이지를 방문하여 네이버 카탈로그 MID를 추출합니다.
 * 이 MID가 검색 결과에서 사용되는 실제 ID입니다.
 *
 * @param page - Puppeteer Page 객체
 * @param productUrl - 스마트스토어 상품 URL
 * @returns Catalog MID (nvMid) 또는 null
 */
export async function getCatalogMidFromUrl(
  page: any,
  productUrl: string
): Promise<string | null> {
  try {
    console.log(`📦 상품 페이지 방문: ${productUrl.substring(0, 80)}...`);

    // API 요청 인터셉트 설정
    let catalogMid: string | null = null;

    const requestHandler = (request: any) => {
      const url = request.url();
      const nvMidMatch = url.match(/[?&]nvMid=(\d{10,})/);
      if (nvMidMatch && !catalogMid) {
        catalogMid = nvMidMatch[1];
      }
    };

    page.on('request', requestHandler);

    // 상품 페이지로 이동
    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 리스너 제거
    page.off('request', requestHandler);

    if (catalogMid) {
      console.log(`✅ API 요청에서 Catalog MID 추출: ${catalogMid}`);
      return catalogMid;
    }

    // 대체 방법 1: URL에서 리다이렉트된 catalog MID 확인
    const currentUrl = page.url();
    if (currentUrl.includes("/catalog/")) {
      const match = currentUrl.match(/\/catalog\/(\d+)/);
      if (match) {
        console.log(`✅ 리다이렉트 URL에서 MID 추출: ${match[1]}`);
        return match[1];
      }
    }

    // 대체 방법 2: 페이지 소스에서 nvMid 검색
    const sourceMid = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const match = html.match(/nvMid["\s:=]+(\d{10,})/);
      return match ? match[1] : null;
    });

    if (sourceMid) {
      console.log(`✅ 페이지 소스에서 MID 추출: ${sourceMid}`);
      return sourceMid;
    }

    // 디버깅: 실제 로드된 페이지 정보 출력
    const pageTitle = await page.title();
    const finalUrl = page.url();
    console.log(`⚠️ Catalog MID를 찾을 수 없습니다`);
    console.log(`   📍 최종 URL: ${finalUrl.substring(0, 100)}...`);
    console.log(`   📄 페이지 제목: ${pageTitle}`);

    // 차단 페이지 감지
    if (pageTitle.includes('보안') || pageTitle.includes('확인') ||
        finalUrl.includes('captcha') || finalUrl.includes('security')) {
      console.log(`   🛑 차단/보안 페이지 감지됨!`);
    }

    return null;
  } catch (error: any) {
    console.error(`❌ Catalog MID 추출 실패: ${error.message}`);
    return null;
  }
}

/**
 * 스마트스토어 URL인지 확인
 */
export function isSmartStoreUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes("smartstore.naver.com");
  } catch {
    return false;
  }
}
