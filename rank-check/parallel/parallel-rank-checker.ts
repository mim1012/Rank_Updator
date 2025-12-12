/**
 * 병렬 순위 체크 시스템 (patchright 버전)
 *
 * 여러 URL의 순위를 동시에 체크하여 전체 실행 시간을 단축합니다.
 * 각 URL마다 독립적인 브라우저 인스턴스를 사용하여 에러를 격리합니다.
 * patchright: Playwright 기반 봇 감지 우회 엔진
 */

import { chromium, type BrowserContext, type Page } from 'patchright';
import { findAccurateRank, type RankResult } from '../accurate-rank-checker';
import { urlToMid, type MidExtractionResult } from '../utils/url-to-mid-converter';
import * as path from 'path';
import * as os from 'os';

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
  blocked?: boolean;  // 차단 감지 여부
}

// 4분할 창 배치 설정
const WINDOW_WIDTH = 480;
const WINDOW_HEIGHT = 400;
const WINDOW_POSITIONS = [
  { x: 0, y: 0 },                      // 좌상단
  { x: WINDOW_WIDTH, y: 0 },           // 우상단
  { x: 0, y: WINDOW_HEIGHT },          // 좌하단
  { x: WINDOW_WIDTH, y: WINDOW_HEIGHT }, // 우하단
];

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

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    // 창 위치 계산 (4개 순환)
    const position = WINDOW_POSITIONS[index % 4];

    // 워커별 프로필 디렉토리 (쿠키/세션 유지)
    const userDataDir = path.join(os.tmpdir(), 'rank-checker-profiles', `worker-${index % 4}`);

    try {
      // persistentContext로 브라우저 시작 (쿠키/세션 유지, 봇 감지 우회)
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,  // Visible 모드 (네이버 봇 탐지 회피)
        channel: 'chrome',  // 시스템에 설치된 Chrome 사용
        viewport: { width: WINDOW_WIDTH - 20, height: WINDOW_HEIGHT - 100 },
        locale: 'ko-KR',
        args: [
          `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
          `--window-position=${position.x},${position.y}`,
          '--disable-blink-features=AutomationControlled',
        ],
      });

      // 기존 페이지 사용 또는 새 페이지 생성
      page = context.pages()[0] || await context.newPage();

      // URL → MID 변환
      const midResult: MidExtractionResult = await urlToMid(request.url, page);

      if (!midResult.mid) {
        await context.close();
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

      // 컨텍스트 종료
      await context.close();

      const duration = Date.now() - startTime;

      // 차단 감지 여부 확인
      const isBlocked = rankResult?.blocked === true;
      if (isBlocked) {
        console.log(`[${index + 1}] 🛑 차단 감지됨`);
      } else {
        console.log(`[${index + 1}] ⏱️  완료: ${Math.round(duration / 1000)}초`);
      }

      return {
        url: request.url,
        keyword: request.keyword,
        productName: request.productName,
        mid: midResult.mid,
        midSource: midResult.source,
        rank: rankResult,
        duration,
        blocked: isBlocked,
      };
    } catch (error: any) {
      console.log(`[${index + 1}] ❌ 에러: ${error.message}`);

      // 컨텍스트 강제 종료
      if (context) {
        await context.close().catch(() => {});
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
   * 여러 URL을 병렬로 순위 체크합니다 (기존 방식 - 배치 단위 대기)
   *
   * @param requests - 순위 체크 요청 배열
   * @returns 순위 체크 결과 배열
   */
  async checkUrls(
    requests: ParallelRankRequest[]
  ): Promise<ParallelRankResult[]> {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 병렬 순위 체크 시작: ${requests.length}개 URL`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const startTime = Date.now();

    // 브라우저 시작 시차 적용 (랜덤 딜레이 0~1초)
    const promises = requests.map((request, index) => {
      const randomDelayMs = Math.random() * 1000; // 0~1초 랜덤

      return new Promise<ParallelRankResult>((resolve) => {
        setTimeout(async () => {
          const result = await this.checkSingleUrl(request, index);
          resolve(result);
        }, randomDelayMs);
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

  /**
   * 워커 풀 방식으로 순위 체크 (각 워커 독립적 생명주기)
   *
   * @param requests - 순위 체크 요청 배열
   * @param numWorkers - 동시 실행 워커 수 (기본 4)
   * @param onResult - 각 결과 완료 시 콜백 (실시간 저장용)
   * @returns 모든 결과 배열
   *
   * @example
   * const checker = new ParallelRankChecker();
   * await checker.checkUrlsWithWorkerPool(requests, 4, async (result, index) => {
   *   await saveResult(result); // 실시간 저장
   *   console.log(`[${index}] 완료: ${result.keyword}`);
   * });
   */
  async checkUrlsWithWorkerPool(
    requests: ParallelRankRequest[],
    numWorkers: number = 4,
    onResult?: (result: ParallelRankResult, index: number) => Promise<void>
  ): Promise<ParallelRankResult[]> {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 워커 풀 순위 체크 시작`);
    console.log(`   📋 총 ${requests.length}개 | 👷 워커 ${numWorkers}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const startTime = Date.now();
    const results: ParallelRankResult[] = new Array(requests.length);
    let nextIndex = 0;
    let completedCount = 0;

    // 워커 함수: 큐에서 작업을 가져와 처리
    const worker = async (workerId: number): Promise<void> => {
      while (true) {
        // 다음 작업 가져오기 (atomic)
        const currentIndex = nextIndex++;
        if (currentIndex >= requests.length) {
          break; // 더 이상 작업 없음
        }

        const request = requests[currentIndex];
        console.log(`[W${workerId}] 🔍 #${currentIndex + 1}/${requests.length}: ${request.keyword}`);

        // 순위 체크 실행
        const result = await this.checkSingleUrl(request, workerId);
        results[currentIndex] = result;
        completedCount++;

        // 진행률 표시
        const progress = Math.round((completedCount / requests.length) * 100);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[W${workerId}] ✅ 완료 (${completedCount}/${requests.length}, ${progress}%, ${elapsed}초)`);

        // 콜백 호출 (실시간 저장)
        if (onResult) {
          try {
            await onResult(result, currentIndex);
          } catch (err: any) {
            console.error(`[W${workerId}] ⚠️ 콜백 에러: ${err.message}`);
          }
        }

        // 짧은 랜덤 딜레이 (봇 감지 회피)
        const delay = 500 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
      }
    };

    // N개 워커 동시 시작
    const workerPromises = Array.from({ length: numWorkers }, (_, i) => worker(i));
    await Promise.all(workerPromises);

    const totalDuration = Date.now() - startTime;
    const avgPerItem = Math.round(totalDuration / requests.length / 1000);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ 워커 풀 완료`);
    console.log(`   ⏱️  총 ${Math.round(totalDuration / 1000)}초 (평균 ${avgPerItem}초/건)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return results;
  }
}
