/**
 * 트래픽 모듈 베이스 클래스
 */

import { connect } from "puppeteer-real-browser";
import type { TrafficProduct, TrafficResult, TrafficOptions, TrafficStats } from "./types";

export abstract class TrafficBase {
  protected browser: any = null;
  protected page: any = null;
  protected stats: TrafficStats = {
    total: 0,
    success: 0,
    failed: 0,
    successRate: 0,
    avgDuration: 0,
  };

  constructor(protected options: TrafficOptions = {}) {
    this.options = {
      dwellTime: 0,
      delayBetween: 1000,
      maxRetries: 1,
      headless: false,
      ...options,
    };
  }

  /**
   * 브라우저 초기화
   */
  async init(): Promise<void> {
    const connection = await connect({
      headless: this.options.headless,
      turnstile: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    this.browser = connection.browser;
    this.page = connection.page;
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * 차단 여부 확인
   */
  protected async isBlocked(): Promise<boolean> {
    try {
      return await this.page.evaluate(() =>
        document.body.innerText.includes("일시적으로 제한")
      );
    } catch {
      return false;
    }
  }

  /**
   * 딜레이
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * 통계 업데이트
   */
  protected updateStats(success: boolean, duration: number): void {
    this.stats.total++;
    if (success) {
      this.stats.success++;
    } else {
      this.stats.failed++;
    }
    this.stats.successRate = (this.stats.success / this.stats.total) * 100;
    this.stats.avgDuration =
      (this.stats.avgDuration * (this.stats.total - 1) + duration) /
      this.stats.total;
  }

  /**
   * 통계 반환
   */
  getStats(): TrafficStats {
    return { ...this.stats };
  }

  /**
   * 단일 트래픽 실행 (서브클래스에서 구현)
   */
  abstract execute(product: TrafficProduct): Promise<TrafficResult>;

  /**
   * 배치 트래픽 실행
   */
  async executeBatch(
    products: TrafficProduct[],
    count: number = 1
  ): Promise<TrafficStats> {
    for (const product of products) {
      for (let i = 0; i < count; i++) {
        const startTime = Date.now();
        const result = await this.execute(product);
        const duration = Date.now() - startTime;

        this.updateStats(result.success, duration);

        if (this.options.delayBetween && i < count - 1) {
          await this.delay(this.options.delayBetween);
        }
      }
    }

    return this.getStats();
  }
}
