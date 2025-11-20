/**
 * Puppeteer Fetch Engine
 *
 * Puppeteer의 page.evaluate()에서 fetch() API를 사용하여
 * 실제 Chrome의 네트워크 스택을 활용하면서도 빠르게 동작합니다.
 *
 * 장점:
 * - 실제 Chrome 네트워크 스택 사용 (봇 탐지 우회)
 * - DOM 렌더링 불필요 (빠름)
 * - 여러 요청을 병렬로 처리 가능
 */

import type { Page } from "puppeteer";

export class PuppeteerFetchEngine {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 브라우저 내에서 fetch() 실행
   *
   * @param url 요청 URL
   * @returns { status, html }
   */
  async fetch(url: string): Promise<{ status: number; html: string }> {
    try {
      console.log(`🌐 [Puppeteer fetch()] ${url.substring(0, 80)}...`);

      // 브라우저 컨텍스트 내에서 fetch() 실행
      const result = await this.page.evaluate(async (fetchUrl) => {
        try {
          const response = await fetch(fetchUrl, {
            method: "GET",
            credentials: "include", // 쿠키 포함
            headers: {
              "upgrade-insecure-requests": "1",
              "accept-language": "ko-KR,ko;q=0.9",
            },
          });

          const html = await response.text();

          return {
            status: response.status,
            html,
            success: true,
          };
        } catch (error: any) {
          return {
            status: 0,
            html: "",
            success: false,
            error: error.message,
          };
        }
      }, url);

      if (!result.success) {
        throw new Error(`fetch() failed: ${result.error}`);
      }

      console.log(`✅ [Puppeteer fetch()] HTTP ${result.status} (${result.html.length} bytes)`);

      return {
        status: result.status,
        html: result.html,
      };
    } catch (error: any) {
      console.error(`❌ [Puppeteer fetch()] Error:`, error.message);
      throw error;
    }
  }

  /**
   * 지연
   */
  async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Puppeteer fetch()를 사용한 순위 체크
 *
 * @param page Puppeteer Page 객체
 * @param keyword 검색 키워드
 * @param productId 상품 ID (nvMid)
 * @param maxPages 최대 페이지 수
 * @returns 순위 (1-400) 또는 -1
 */
export async function checkRankWithPuppeteerFetch(
  page: Page,
  keyword: string,
  productId: string,
  maxPages: number = 10
): Promise<number> {
  const engine = new PuppeteerFetchEngine(page);
  const productsPerPage = 40;

  console.log(`🚀 [Puppeteer fetch()] Starting rank check`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Product ID: ${productId}`);
  console.log(`   Method: Browser fetch() API (fastest + bypasses bot detection)`);

  // 먼저 네이버 홈 방문하여 쿠키 획득
  try {
    console.log(`🏠 Visiting Naver home for cookies...`);
    await page.goto("https://m.naver.com/", { waitUntil: "domcontentloaded" });
    await engine.delay(500);
    console.log(`✅ Cookies acquired`);
  } catch (error: any) {
    console.warn(`⚠️  Failed to visit home:`, error.message);
  }

  for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
    try {
      // 검색 URL 생성
      const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
        keyword
      )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

      console.log(`📄 Page ${currentPage}/${maxPages}`);

      // fetch() 실행 (브라우저 컨텍스트 내)
      const { status, html } = await engine.fetch(searchUrl);

      if (status !== 200) {
        console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);

        if (status === 418) {
          console.log(`❌ HTTP 418 - Bot detected even with fetch()`);
        }

        continue;
      }

      // 성공!
      console.log(`🎉 HTTP 200 with Puppeteer fetch()!`);

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
      await engine.delay(1000);
    } catch (error: any) {
      console.error(`❌ Page ${currentPage} error:`, error.message);
    }
  }

  console.log(`❌ Product not found in ${maxPages} pages`);
  return -1;
}
