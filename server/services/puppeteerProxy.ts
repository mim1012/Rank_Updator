/**
 * Puppeteer Proxy Engine
 *
 * Puppeteer를 HTTP 프록시처럼 사용하여
 * Puppeteer의 성공적인 네트워크 스택을 그대로 활용합니다.
 *
 * 전략: Puppeteer는 이미 봇 탐지를 우회했으므로,
 *       Puppeteer를 통해 모든 요청을 보냅니다!
 */

import type { Page } from "puppeteer";

export class PuppeteerProxy {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Puppeteer를 통해 HTTP GET 요청
   *
   * @param url 요청 URL
   * @returns HTML 응답
   */
  async get(url: string): Promise<{ status: number; html: string }> {
    try {
      console.log(`🌐 [PuppeteerProxy] Requesting: ${url.substring(0, 80)}...`);

      // Puppeteer의 page.goto()를 사용
      // 이것은 실제 Chrome의 네트워크 스택을 사용합니다!
      const response = await this.page.goto(url, {
        waitUntil: "domcontentloaded", // HTML만 필요하므로 빠르게
        timeout: 30000,
      });

      if (!response) {
        throw new Error("No response from page.goto()");
      }

      const status = response.status();
      const html = await this.page.content();

      console.log(`✅ [PuppeteerProxy] HTTP ${status} (${html.length} bytes)`);

      return { status, html };
    } catch (error: any) {
      console.error(`❌ [PuppeteerProxy] Error:`, error.message);
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
 * Puppeteer Proxy를 사용한 순위 체크
 *
 * 이것은 사실상 Puppeteer 모드와 거의 동일하지만,
 * HTTP 요청처럼 사용할 수 있도록 추상화했습니다.
 */
export async function checkRankWithPuppeteerProxy(
  page: Page,
  keyword: string,
  productId: string,
  maxPages: number = 10
): Promise<number> {
  const proxy = new PuppeteerProxy(page);
  const productsPerPage = 40;

  console.log(`🚀 [PuppeteerProxy] Starting rank check`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Product ID: ${productId}`);

  for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
    try {
      // 검색 URL 생성
      const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(
        keyword
      )}&pagingIndex=${currentPage}&pagingSize=40&sort=rel&viewType=list&productSet=total`;

      console.log(`📄 Page ${currentPage}/${maxPages}`);

      // Puppeteer를 통해 요청 (봇 탐지 우회!)
      const { status, html } = await proxy.get(searchUrl);

      if (status !== 200) {
        console.log(`⚠️  Page ${currentPage}: HTTP ${status}`);
        continue;
      }

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

      // 페이지 간 딜레이
      await proxy.delay(1000);
    } catch (error: any) {
      console.error(`❌ Page ${currentPage} error:`, error.message);
    }
  }

  console.log(`❌ Product not found in ${maxPages} pages`);
  return -1;
}
