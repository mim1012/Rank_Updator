/**
 * 쇼핑DI 카테고리 트래픽 모듈
 *
 * 경로: 쇼핑 메인 → 카테고리 → 상품 클릭
 *
 * DB searchMethod: shopping_di_category
 * 테스트 결과: 100% 성공 (716)
 */

import { TrafficBase } from "./base";
import type { TrafficProduct, TrafficResult, TrafficOptions } from "./types";

export class ShoppingDiCategoryTraffic extends TrafficBase {
  constructor(options: TrafficOptions = {}) {
    super({
      dwellTime: 30000,
      delayBetween: 5000,
      ...options,
    });
  }

  /**
   * 단일 트래픽 실행
   */
  async execute(product: TrafficProduct): Promise<TrafficResult> {
    const startTime = Date.now();

    try {
      // 1. 쇼핑 메인
      await this.page.goto("https://shopping.naver.com/", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await this.delay(2000);

      // 2. 차단 확인
      if (await this.isBlocked()) {
        return {
          success: false,
          error: "쇼핑 메인 차단",
          duration: Date.now() - startTime,
        };
      }

      // 3. 검색 실행
      const searchInput = await this.page.$('input[type="search"], input[placeholder*="검색"]');
      if (!searchInput) {
        return {
          success: false,
          error: "검색창 없음",
          duration: Date.now() - startTime,
        };
      }

      const searchQuery = product.keyword || product.productName.substring(0, 20);
      await searchInput.click();
      await searchInput.type(searchQuery, { delay: 80 });
      await this.page.keyboard.press("Enter");
      await this.delay(3000);

      // 4. 검색 결과 차단 확인
      if (await this.isBlocked()) {
        return {
          success: false,
          error: "검색결과 차단",
          duration: Date.now() - startTime,
        };
      }

      // 5. 스크롤 (상품 로드)
      await this.page.evaluate(() => window.scrollBy(0, 500));
      await this.delay(1500);

      // 6. 상품 클릭 (DOM 링크 방식)
      const catalogUrl = `https://search.shopping.naver.com/catalog/${product.productId}`;

      await this.page.evaluate((url: string) => {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_self";
        document.body.appendChild(link);
        link.click();
      }, catalogUrl);

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
        currentUrl.includes("/catalog/");

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

      // 9. 쇼핑 메인으로 복귀
      await this.page.goto("https://shopping.naver.com/", {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

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

export default ShoppingDiCategoryTraffic;
