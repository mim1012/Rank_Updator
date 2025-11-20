/**
 * curl-impersonate Engine
 *
 * curl-impersonate는 Chrome의 TLS fingerprint를 바이너리 레벨에서 완벽하게 복제합니다.
 *
 * curl-impersonate 특징:
 * - Chrome의 실제 TLS handshake 재현
 * - JA3 fingerprint 일치
 * - HTTP/2 Settings 프레임 일치
 * - Cipher suites 순서 일치
 */

import { curlRequest } from "cuimp";

/**
 * curl-impersonate를 사용한 HTTP 요청
 *
 * @param url 요청 URL
 * @param headers 헤더 (선택)
 * @returns { status, html }
 */
export async function curlImpersonateGet(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: number; html: string }> {
  try {
    console.log(`🌐 [curl-impersonate] ${url.substring(0, 80)}...`);

    // cuimp API 사용
    const response = await curlRequest({
      url,
      method: "GET",
      impersonate: "chrome110", // Chrome 110 impersonation
      headers: headers || {},
      followRedirects: true,
      timeout: 30000,
    });

    const status = response.statusCode || 0;
    const html = response.body || "";

    console.log(
      `✅ [curl-impersonate] HTTP ${status} (${html.length} bytes)`
    );

    return { status, html };
  } catch (error: any) {
    console.error(`❌ [curl-impersonate] Error:`, error.message);

    // 에러에서도 상태 코드 추출 시도
    if (error.response) {
      return {
        status: error.response.statusCode || 0,
        html: error.response.body || "",
      };
    }

    throw error;
  }
}

/**
 * curl-impersonate를 사용한 순위 체크
 */
export async function checkRankWithCurlImpersonate(
  keyword: string,
  productId: string,
  maxPages: number = 10
): Promise<number> {
  console.log(`🚀 [curl-impersonate] Starting rank check`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Product ID: ${productId}`);
  console.log(`   Impersonation: Chrome 110`);
  console.log(`   TLS Fingerprint: Real Chrome binary`);

  const productsPerPage = 40;

  // 최소한의 헤더
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36",
    "upgrade-insecure-requests": "1",
    "accept-language": "ko-KR,ko;q=0.9",
  };

  for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
    try {
      const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
        keyword
      )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

      console.log(`📄 Page ${currentPage}/${maxPages}`);

      // curl-impersonate로 요청
      const { status, html } = await curlImpersonateGet(searchUrl, headers);

      if (status !== 200) {
        console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

        if (status === 418) {
          console.log(`❌ HTTP 418 - curl-impersonate also failed`);
          console.log(`   TLS fingerprinting detection is too strong`);
        }

        continue;
      }

      // 성공!
      console.log(`🎉 HTTP 200! curl-impersonate bypassed bot detection!`);

      // nvMid로 상품 찾기
      const nvMidPattern = new RegExp(`nvMid=${productId}`, "i");

      if (nvMidPattern.test(html)) {
        const nvMidMatches = html.match(/nvMid=(\d+)/g) || [];
        const position = nvMidMatches.findIndex((match) =>
          match.includes(productId)
        );

        if (position >= 0) {
          const absoluteRank = (currentPage - 1) * productsPerPage + position + 1;
          console.log(`✅ Found product at rank ${absoluteRank}!`);
          return absoluteRank;
        }
      }

      console.log(`   Product not found on page ${currentPage}`);

      // 딜레이
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Page ${currentPage} error:`, error.message);
    }
  }

  console.log(`❌ Product not found in ${maxPages} pages`);
  return -1;
}
