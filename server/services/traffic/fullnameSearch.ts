/**
 * 통합검색DI 트래픽 모듈
 *
 * 경로: 네이버 메인 → 통합검색 → 쇼핑 탭 → 상품 클릭
 *
 * DB searchMethod: fullname_v4_parallel
 * 테스트 결과: 100% 성공 (697, 701, 778)
 */

import { TrafficBase } from "./base";
import type { TrafficProduct, TrafficResult, TrafficOptions } from "./types";

export class FullnameSearchTraffic extends TrafficBase {
  constructor(options: TrafficOptions = {}) {
    super({
      dwellTime: 20000,
      delayBetween: 3000,
      ...options,
    });
  }

  /**
   * 단일 트래픽 실행
   */
  async execute(product: TrafficProduct): Promise<TrafficResult> {
    const startTime = Date.now();

    try {
      // 1. 네이버 메인
      await this.page.goto("https://www.naver.com/", {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await this.delay(1500);

      // 2. 검색창에 상품명 풀네임 입력
      const searchQuery = product.productName.substring(0, 50); // 너무 길면 자름
      await this.page.type("#query", searchQuery, { delay: 50 });
      await this.page.keyboard.press("Enter");
      await this.delay(3000);

      // 3. 차단 확인
      if (await this.isBlocked()) {
        return {
          success: false,
          error: "통합검색 차단",
          duration: Date.now() - startTime,
        };
      }

      // 4. 쇼핑 탭 클릭
      const shopTab = await this.page.$('a[href*="search.shopping.naver.com/search"]');
      if (!shopTab) {
        return {
          success: false,
          error: "쇼핑 탭 없음",
          duration: Date.now() - startTime,
        };
      }

      await shopTab.click();
      await this.delay(3000);

      // 5. 쇼핑 검색 결과 차단 확인
      if (await this.isBlocked()) {
        return {
          success: false,
          error: "쇼핑검색 차단",
          duration: Date.now() - startTime,
        };
      }

      // 6. 상품 링크 클릭
      const productLink = await this.page.$('a[href*="/products/"], a[href*="/catalog/"]');
      if (!productLink) {
        return {
          success: false,
          error: "상품 링크 없음",
          duration: Date.now() - startTime,
        };
      }

      await productLink.click();
      await this.delay(4000);

      // 7. 상품 페이지 확인
      const currentUrl = this.page.url();
      if (await this.isBlocked()) {
        return {
          success: false,
          error: "상품페이지 차단",
          url: currentUrl,
          duration: Date.now() - startTime,
        };
      }

      const isProductPage =
        currentUrl.includes("/products/") ||
        currentUrl.includes("/catalog/") ||
        currentUrl.includes("smartstore");

      if (!isProductPage) {
        return {
          success: false,
          error: "상품페이지 아님",
          url: currentUrl,
          duration: Date.now() - startTime,
        };
      }

      // 8. 체류 시간
      if (this.options.dwellTime && this.options.dwellTime > 0) {
        await this.delay(this.options.dwellTime);
      }

      return {
        success: true,
        url: currentUrl,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}

export default FullnameSearchTraffic;
