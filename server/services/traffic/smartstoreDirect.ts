/**
 * 스마트스토어 직접 접근 트래픽 모듈
 *
 * 특징:
 * - smartstore.naver.com 직접 접근
 * - 카탈로그 차단 우회 가능
 * - 네이버 메인 먼저 접속 권장
 *
 * 테스트 결과: 2025-11-22 ✅ 성공
 */

import { TrafficBase } from "./base";
import type { TrafficProduct, TrafficResult, TrafficOptions } from "./types";

export class SmartstoreDirectTraffic extends TrafficBase {
  constructor(options: TrafficOptions = {}) {
    super({
      dwellTime: 3000,
      delayBetween: 2000,
      ...options,
    });
  }

  /**
   * 스마트스토어 URL 생성
   */
  private getSmartStoreUrl(product: TrafficProduct): string | null {
    // 이미 스마트스토어 URL이 있으면 사용
    if (product.smartstoreUrl) {
      return product.smartstoreUrl;
    }

    // productId로 URL 생성 (스토어명 필요)
    // 실제로는 DB에서 스토어명을 가져와야 함
    return null;
  }

  /**
   * 단일 트래픽 실행
   */
  async execute(product: TrafficProduct): Promise<TrafficResult> {
    const startTime = Date.now();

    try {
      // 1. 네이버 메인 먼저 접속 (세션/쿠키 설정)
      if (!this.page.url().includes("naver.com")) {
        await this.page.goto("https://www.naver.com/", {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        await this.delay(1000);
      }

      // 2. 스마트스토어 URL 가져오기
      const smartstoreUrl = this.getSmartStoreUrl(product);
      if (!smartstoreUrl) {
        return {
          success: false,
          error: "스마트스토어 URL 없음",
          duration: Date.now() - startTime,
        };
      }

      // 3. 스마트스토어 페이지로 이동
      await this.page.goto(smartstoreUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await this.delay(2000);

      // 4. 차단 확인
      if (await this.isBlocked()) {
        return {
          success: false,
          error: "차단됨",
          url: this.page.url(),
          duration: Date.now() - startTime,
        };
      }

      // 5. 상품 페이지 확인
      const currentUrl = this.page.url();
      const isProductPage =
        currentUrl.includes("/products/") ||
        currentUrl.includes("smartstore.naver.com");

      if (!isProductPage) {
        return {
          success: false,
          error: "상품페이지 아님",
          url: currentUrl,
          duration: Date.now() - startTime,
        };
      }

      // 6. 체류 시간
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

  /**
   * URL로 직접 실행
   */
  async executeByUrl(url: string): Promise<TrafficResult> {
    return this.execute({
      id: 0,
      productId: "",
      productName: "",
      smartstoreUrl: url,
    });
  }
}

export default SmartstoreDirectTraffic;
