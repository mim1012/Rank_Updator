/**
 * 패킷 빠른 진입 트래픽 모듈
 *
 * 특징:
 * - 체류 없이 빠른 진입
 * - ~3초/회 속도
 * - 브라우저 재사용으로 효율적
 *
 * DB searchMethod: packet_fast_catalog
 * 테스트 결과: 99.7% (299/300)
 */

import { TrafficBase } from "./base";
import type { TrafficProduct, TrafficResult, TrafficOptions } from "./types";

export class PacketFastTraffic extends TrafficBase {
  constructor(options: TrafficOptions = {}) {
    super({
      dwellTime: 0,        // 체류 없음
      delayBetween: 500,   // 최소 대기
      ...options,
    });
  }

  /**
   * 단일 트래픽 실행
   */
  async execute(product: TrafficProduct): Promise<TrafficResult> {
    const startTime = Date.now();

    try {
      // 1. 쇼핑 메인 확인 (이미 있으면 스킵)
      if (!this.page.url().includes("shopping.naver.com")) {
        await this.page.goto("https://shopping.naver.com/", {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        await this.delay(1000);
      }

      // 2. 카탈로그 URL로 DOM 링크 클릭
      const catalogUrl = `https://search.shopping.naver.com/catalog/${product.productId}`;

      await this.page.evaluate((url: string) => {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_self";
        document.body.appendChild(link);
        link.click();
      }, catalogUrl);

      // 3. 최소 대기
      await this.delay(2000);

      // 4. 성공 확인
      const currentUrl = this.page.url();
      const isProductPage =
        currentUrl.includes("/products/") ||
        currentUrl.includes("/catalog/");

      if (!isProductPage) {
        // 쇼핑 메인으로 복귀
        await this.page.goto("https://shopping.naver.com/", {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        return {
          success: false,
          error: "상품페이지 아님",
          url: currentUrl,
          duration: Date.now() - startTime,
        };
      }

      // 5. 차단 확인
      if (await this.isBlocked()) {
        await this.page.goto("https://shopping.naver.com/", {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        return {
          success: false,
          error: "차단됨",
          url: currentUrl,
          duration: Date.now() - startTime,
        };
      }

      // 6. 체류 시간 (설정된 경우)
      if (this.options.dwellTime && this.options.dwellTime > 0) {
        await this.delay(this.options.dwellTime);
      }

      // 7. 쇼핑 메인으로 복귀
      await this.page.goto("https://shopping.naver.com/", {
        waitUntil: "domcontentloaded",
        timeout: 10000,
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

  /**
   * 스마트스토어 URL로 빠른 진입 (차단 우회)
   */
  async executeSmartstore(smartstoreUrl: string): Promise<TrafficResult> {
    const startTime = Date.now();

    try {
      // 1. 네이버 메인 먼저
      if (!this.page.url().includes("naver.com")) {
        await this.page.goto("https://www.naver.com/", {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        await this.delay(1000);
      }

      // 2. 스마트스토어로 이동
      await this.page.goto(smartstoreUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await this.delay(2000);

      // 3. 확인
      const currentUrl = this.page.url();
      const isProductPage = currentUrl.includes("smartstore.naver.com");

      if (!isProductPage || (await this.isBlocked())) {
        return {
          success: false,
          error: "접근 실패",
          url: currentUrl,
          duration: Date.now() - startTime,
        };
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

export default PacketFastTraffic;
