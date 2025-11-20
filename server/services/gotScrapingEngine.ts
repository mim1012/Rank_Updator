/**
 * got-scraping Engine
 *
 * got-scraping을 사용하여 Chrome의 HTTP/2 및 TLS fingerprint를 재현합니다.
 *
 * got-scraping 특징:
 * - HTTP/2 지원
 * - TLS fingerprinting
 * - Chrome impersonation
 * - Header order preservation
 */

import { gotScraping } from "got-scraping";

/**
 * got-scraping을 사용한 HTTP 요청
 *
 * @param url 요청 URL
 * @param headers 헤더 (선택)
 * @returns { status, html }
 */
export async function gotScrapingGet(
  url: string,
  headers?: Record<string, string>
): Promise<{ status: number; html: string }> {
  try {
    console.log(`🌐 [got-scraping] ${url.substring(0, 80)}...`);

    const response = await gotScraping({
      url,
      method: "GET",
      headers: headers || {},
      http2: true, // HTTP/2 활성화
      responseType: "text",
      retry: {
        limit: 0, // 재시도 없음
      },
      timeout: {
        request: 30000,
      },
    });

    console.log(`✅ [got-scraping] HTTP ${response.statusCode} (${response.body.length} bytes)`);

    return {
      status: response.statusCode,
      html: response.body,
    };
  } catch (error: any) {
    console.error(`❌ [got-scraping] Error:`, error.message);

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
 * got-scraping을 사용한 순위 체크
 */
export async function checkRankWithGotScraping(
  keyword: string,
  productId: string,
  maxPages: number = 10
): Promise<number> {
  console.log(`🚀 [got-scraping] Starting rank check`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Product ID: ${productId}`);
  console.log(`   HTTP/2: Enabled`);
  console.log(`   TLS Fingerprinting: Chrome impersonation`);

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

      // got-scraping으로 요청
      const { status, html } = await gotScrapingGet(searchUrl, headers);

      if (status !== 200) {
        console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

        if (status === 418) {
          console.log(`❌ HTTP 418 - got-scraping also failed`);
        }

        continue;
      }

      // 성공!
      console.log(`🎉 HTTP 200! got-scraping bypassed bot detection!`);

      // nvMid로 상품 찾기
      const nvMidPattern = new RegExp(`nvMid=${productId}`, "i");

      if (nvMidPattern.test(html)) {
        const nvMidMatches = html.match(/nvMid=(\\d+)/g) || [];
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
