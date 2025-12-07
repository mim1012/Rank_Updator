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

    // API 요청/응답 인터셉트 설정
    let catalogMid: string | null = null;

    // request에서 nvMid 찾기
    const requestHandler = (request: any) => {
      const url = request.url();
      // nvMid 파라미터 (10자리 이상)
      let match = url.match(/[?&]nvMid=(\d{10,})/);
      if (match && !catalogMid) {
        catalogMid = match[1];
        return;
      }
      // productId 파라미터
      match = url.match(/[?&]productId=(\d{10,})/);
      if (match && !catalogMid) {
        catalogMid = match[1];
        return;
      }
      // catalog URL 패턴
      match = url.match(/\/catalog\/(\d{10,})/);
      if (match && !catalogMid) {
        catalogMid = match[1];
      }
    };

    // response에서도 nvMid 찾기
    const responseHandler = (response: any) => {
      const url = response.url();
      const match = url.match(/[?&]nvMid=(\d{10,})/);
      if (match && !catalogMid) {
        catalogMid = match[1];
      }
    };

    page.on('request', requestHandler);
    page.on('response', responseHandler);

    // 상품 페이지로 이동 (networkidle2로 API 완료 대기)
    await page.goto(productUrl, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });

    // 추가 대기 (느린 네트워크 대응)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 스크롤하여 추가 API 트리거
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 리스너 제거
    page.off('request', requestHandler);
    page.off('response', responseHandler);

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

    // 대체 방법 2: 페이지 소스에서 nvMid 검색 (여러 패턴 시도)
    const sourceMid = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;

      // 패턴 1: nvMid 파라미터
      let match = html.match(/nvMid["\s:=]+(\d{10,})/);
      if (match) return match[1];

      // 패턴 2: catalogId
      match = html.match(/catalogId["\s:=]+(\d{10,})/);
      if (match) return match[1];

      // 패턴 3: productId (네이버 쇼핑용)
      match = html.match(/"productId"\s*:\s*"?(\d{10,})"?/);
      if (match) return match[1];

      // 패턴 4: channelProductNo와 연관된 nvMid
      match = html.match(/nvMid[=:](\d{10,})/);
      if (match) return match[1];

      return null;
    });

    if (sourceMid) {
      console.log(`✅ 페이지 소스에서 MID 추출: ${sourceMid}`);
      return sourceMid;
    }

    // 대체 방법 3: 네이버 쇼핑 연동 API에서 추출 (스크립트 태그)
    const scriptMid = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || '';
        // __PRELOADED_STATE__ 또는 window.__INITIAL_STATE__ 에서 찾기
        const match = content.match(/(?:nvMid|catalogNo|productId)["\s:=]+["']?(\d{10,})["']?/);
        if (match) return match[1];
      }
      return null;
    });

    if (scriptMid) {
      console.log(`✅ 스크립트에서 MID 추출: ${scriptMid}`);
      return scriptMid;
    }

    // 대체 방법 4: meta 태그에서 추출
    const metaMid = await page.evaluate(() => {
      // og:url에서 catalog ID 추출
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) {
        const content = ogUrl.getAttribute('content') || '';
        const match = content.match(/catalog\/(\d+)/);
        if (match) return match[1];
      }
      return null;
    });

    if (metaMid) {
      console.log(`✅ 메타 태그에서 MID 추출: ${metaMid}`);
      return metaMid;
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
