/**
 * 병렬 순위 체크 시스템
 *
 * 여러 URL의 순위를 동시에 체크하여 전체 실행 시간을 단축합니다.
 * 각 URL마다 독립적인 브라우저 인스턴스를 사용하여 에러를 격리합니다.
 */

import { connect } from 'puppeteer-real-browser';
import { findAccurateRank, type RankResult } from '../accurate-rank-checker';
import { urlToMid, type MidExtractionResult } from '../utils/url-to-mid-converter';

export interface ParallelRankRequest {
  url: string;
  keyword: string;
  productName?: string;
  maxPages?: number;
}

export interface ParallelRankResult {
  url: string;
  keyword: string;
  productName?: string;
  mid: string | null;
  midSource: 'direct' | 'catalog' | 'failed';
  rank: RankResult | null;
  duration: number;
  error?: string;
}

export class ParallelRankChecker {
  /**
   * 단일 URL의 순위를 체크합니다 (Promise.all 내부에서 실행됨)
   *
   * @param request - 순위 체크 요청
   * @param index - 요청 인덱스 (로그용)
   * @returns 순위 체크 결과
   */
  private async checkSingleUrl(
    request: ParallelRankRequest,
    index: number
  ): Promise<ParallelRankResult> {
    const startTime = Date.now();

    console.log(
      `[${index + 1}] 🌐 브라우저 시작: ${request.url.substring(0, 60)}...`
    );

    let browser: any = null;
    let page: any = null;

    try {
      // 독립적인 브라우저 인스턴스 생성
      const connection = await connect({
        headless: false,  // Visible 모드 (네이버 봇 탐지 회피)
        turnstile: true,
        fingerprint: true,
      });

      browser = connection.browser;
      page = connection.page;

      // URL → MID 변환
      const midResult: MidExtractionResult = await urlToMid(request.url, page);

      if (!midResult.mid) {
        await browser.close();
        return {
          url: request.url,
          keyword: request.keyword,
          productName: request.productName,
          mid: null,
          midSource: 'failed',
          rank: null,
          duration: Date.now() - startTime,
          error: 'MID 추출 실패',
        };
      }

      console.log(
        `[${index + 1}] ✅ MID 추출: ${midResult.mid} (${midResult.source})`
      );

      // 순위 체크 (검증된 함수 사용)
      const maxPages = request.maxPages ?? 15;
      const rankResult = await findAccurateRank(
        page,
        request.keyword,
        midResult.mid,
        maxPages
      );

      // 브라우저 종료
      await browser.close();

      const duration = Date.now() - startTime;
      console.log(
        `[${index + 1}] ⏱️  완료: ${Math.round(duration / 1000)}초`
      );

      return {
        url: request.url,
        keyword: request.keyword,
        productName: request.productName,
        mid: midResult.mid,
        midSource: midResult.source,
        rank: rankResult,
        duration,
      };
    } catch (error: any) {
      console.log(`[${index + 1}] ❌ 에러: ${error.message}`);

      // 브라우저 강제 종료
      if (browser) {
        await browser.close().catch(() => {});
      }

      return {
        url: request.url,
        keyword: request.keyword,
        productName: request.productName,
        mid: null,
        midSource: 'failed',
        rank: null,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * 여러 URL을 병렬로 순위 체크합니다
   *
   * @param requests - 순위 체크 요청 배열
   * @returns 순위 체크 결과 배열
   *
   * @example
   * const checker = new ParallelRankChecker();
   * const results = await checker.checkUrls([
   *   { url: 'https://...', keyword: '장난감' },
   *   { url: 'https://...', keyword: '장난감' },
   * ]);
   */
  async checkUrls(
    requests: ParallelRankRequest[]
  ): Promise<ParallelRankResult[]> {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 병렬 순위 체크 시작: ${requests.length}개 URL`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const startTime = Date.now();

    // 브라우저 시작 시차 적용 (rate limiting 방지)
    const promises = requests.map((request, index) => {
      const staggerDelayMs = index * 1500; // 1.5초 간격

      return new Promise<ParallelRankResult>((resolve) => {
        setTimeout(async () => {
          const result = await this.checkSingleUrl(request, index);
          resolve(result);
        }, staggerDelayMs);
      });
    });

    // 모든 체크가 완료될 때까지 대기
    const results = await Promise.all(promises);

    const totalDuration = Date.now() - startTime;
    console.log(
      `\n✅ 모든 체크 완료: ${Math.round(totalDuration / 1000)}초`
    );

    return results;
  }
}
