/**
 * 병렬 순위 체크 시스템 (ProductId 방식 전용)
 *
 * 여러 URL의 순위를 동시에 체크하여 전체 실행 시간을 단축합니다.
 * 각 URL마다 독립적인 브라우저 인스턴스를 사용하여 에러를 격리합니다.
 *
 * ✅ ProductId 방식만 사용 (URL 직접 방문 제거):
 * - URL에서 productId 추출 (/products/숫자)
 * - 네이버 검색 → 쇼핑탭 → DOM에서 chnl_prod_no 매칭
 * - 캡챠 없음, 빠름
 */

import { connect } from 'puppeteer-real-browser';
import { type RankResult } from '../accurate-rank-checker';
import { humanScroll, humanType } from '../utils/humanBehavior';
import { getCatalogMidFromUrl } from '../utils/getCatalogMidFromUrl';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// ProductId 방식 상수
const SAFE_DELAY_MS = 5000;
const SCROLL_STEPS = 18;
const MAX_PAGES_PRODUCTID = 15;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ProductId 방식 헬퍼 함수들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * URL에서 productId 추출 (모든 네이버 URL)
 * - smartstore.naver.com/xxx/products/12345
 * - brand.naver.com/xxx/products/12345
 * - shopping.naver.com/xxx/products/12345
 */
function extractProductIdFromUrl(url: string): string | null {
  const match = url.match(/\/products\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * ProductId 추출 가능한 URL인지 확인
 */
function hasProductId(url: string): boolean {
  return extractProductIdFromUrl(url) !== null;
}

/**
 * 차단 여부 확인
 */
async function isBlocked(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText ?? '';
    return (
      bodyText.includes('보안 확인') ||
      bodyText.includes('자동 입력 방지') ||
      bodyText.includes('일시적으로 제한')
    );
  });
}

/**
 * 쇼핑탭 진입 (productId 방식용)
 */
async function enterShoppingTabForProductId(page: any, keyword: string, logPrefix: string): Promise<boolean> {
  console.log(`${logPrefix} 🧭 네이버 메인 진입`);
  try {
    await page.goto('https://www.naver.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
  } catch (error) {
    console.log(`${logPrefix} ⚠️ 네이버 진입 실패`);
    return false;
  }

  await delay(SAFE_DELAY_MS);

  const searchInput = await page.waitForSelector('input[name="query"]', { timeout: 15000 }).catch(() => null);
  if (!searchInput) {
    console.log(`${logPrefix} ❌ 검색 입력창 없음`);
    return false;
  }

  await searchInput.click({ clickCount: 3 });
  await humanType(page, keyword);
  await page.keyboard.press('Enter');

  console.log(`${logPrefix} ⏳ 검색 결과 대기...`);
  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch {}
  await delay(3000);

  console.log(`${logPrefix} 🛒 쇼핑탭 이동`);
  let clicked = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    clicked = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="search.shopping.naver.com"]');
      if (!link) return false;
      link.removeAttribute('target');
      link.click();
      return true;
    });
    if (clicked) break;
    await delay(2000);
  }

  if (!clicked) {
    console.log(`${logPrefix} ❌ 쇼핑탭 링크 없음`);
    return false;
  }

  await delay(SAFE_DELAY_MS + 800);

  if (!page.url().includes('search.shopping.naver.com')) {
    console.log(`${logPrefix} ⚠️ 쇼핑탭 URL 미확인`);
    return false;
  }

  if (await isBlocked(page)) {
    console.log(`${logPrefix} 🛑 보안 페이지 감지`);
    return false;
  }

  return true;
}

/**
 * 스크롤로 lazy loading 트리거
 */
async function hydrateCurrentPage(page: any): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(600);
}

/**
 * 현재 페이지에서 productId로 순위 찾기
 */
async function findRankByProductIdOnPage(page: any, targetProductId: string): Promise<{
  found: boolean;
  pageRank: number | null;
  catalogNvMid: string | null;
  productName: string | null;
  isAd: boolean;
}> {
  return await page.evaluate((targetId: string) => {
    const result = {
      found: false,
      pageRank: null as number | null,
      catalogNvMid: null as string | null,
      productName: null as string | null,
      isAd: false,
    };

    const anchors = document.querySelectorAll('a[data-shp-contents-id][data-shp-contents-rank][data-shp-contents-dtl]');

    for (const anchor of anchors) {
      let mid = anchor.getAttribute('data-shp-contents-id');
      if (!mid) continue;

      const dtl = anchor.getAttribute('data-shp-contents-dtl');
      const rankStr = anchor.getAttribute('data-shp-contents-rank');
      const inventory = anchor.getAttribute('data-shp-inventory') || '';

      if (!dtl || !rankStr) continue;

      try {
        const normalized = dtl.replace(/&quot;/g, '"');
        const parsed = JSON.parse(normalized);

        if (!Array.isArray(parsed)) continue;

        let chnlProdNo: string | null = null;
        let catalogNvMid: string | null = null;
        let prodName: string | null = null;

        for (const item of parsed) {
          if (item.key === 'chnl_prod_no' && item.value) {
            chnlProdNo = String(item.value);
          }
          if (item.key === 'catalog_nv_mid' && item.value) {
            catalogNvMid = String(item.value);
          }
          if (item.key === 'nv_mid' && item.value) {
            // ✅ 광고 상품: nv_mid 추출
            if (mid.startsWith('nad-')) {
              catalogNvMid = String(item.value);
            }
          }
          if (item.key === 'prod_nm' && item.value) {
            prodName = String(item.value).substring(0, 60);
          }
        }

        if (chnlProdNo === targetId) {
          result.found = true;
          result.pageRank = parseInt(rankStr, 10);
          result.catalogNvMid = catalogNvMid;
          result.productName = prodName;
          result.isAd = /lst\*(A|P|D)/.test(inventory);
          return result;
        }
      } catch {}
    }

    return result;
  }, targetProductId);
}

/**
 * 다음 페이지 이동
 */
async function goToNextPageForProductId(page: any, targetPage: number): Promise<boolean> {
  const paginationSelector = 'a.pagination_btn_page__utqBz, a[class*="pagination_btn"]';

  try {
    await page.waitForSelector(paginationSelector, { timeout: 10000, visible: true });
  } catch {
    return false;
  }

  const buttonExists = await page.evaluate((nextPage: number) => {
    const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz, a[class*="pagination_btn"]');
    for (const btn of buttons) {
      if (btn.textContent?.trim() === String(nextPage)) return true;
    }
    return false;
  }, targetPage);

  if (!buttonExists) return false;

  const apiResponsePromise = page.waitForResponse(
    (response: any) => {
      const url = response.url();
      return url.includes('/api/search/all') && url.includes(`pagingIndex=${targetPage}`);
    },
    { timeout: 30000 }
  );

  try {
    const pageButton = await page.evaluateHandle((nextPage: number) => {
      const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz, a[class*="pagination_btn"]');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === String(nextPage)) return btn;
      }
      return null;
    }, targetPage);

    if (!pageButton) return false;
    await (pageButton.asElement() as any).click();
  } catch {
    return false;
  }

  try {
    await apiResponsePromise;
  } catch {}

  await delay(1500);
  return true;
}

/**
 * ProductId 기반 순위 체크 (스마트스토어 URL용)
 */
async function checkRankByProductId(
  page: any,
  keyword: string,
  productId: string,
  logPrefix: string
): Promise<{
  rank: number | null;
  catalogNvMid: string | null;
  productName: string | null;
  page: number | null;
  isAd: boolean;
  blocked: boolean;
  error?: string;
}> {
  // 쇼핑탭 진입
  const shoppingReady = await enterShoppingTabForProductId(page, keyword, logPrefix);
  if (!shoppingReady) {
    const blocked = await isBlocked(page);
    return {
      rank: null,
      catalogNvMid: null,
      productName: null,
      page: null,
      isAd: false,
      blocked,
      error: blocked ? '보안 페이지' : '쇼핑탭 진입 실패',
    };
  }

  // 페이지 순회
  for (let currentPage = 1; currentPage <= MAX_PAGES_PRODUCTID; currentPage++) {
    if (currentPage > 1) {
      const randomDelay = 1000 + Math.random() * 1000;
      await delay(randomDelay);

      const moved = await goToNextPageForProductId(page, currentPage);
      if (!moved) {
        return {
          rank: null,
          catalogNvMid: null,
          productName: null,
          page: null,
          isAd: false,
          blocked: false,
          error: `${currentPage - 1}페이지까지 검색`,
        };
      }

      if (await isBlocked(page)) {
        return {
          rank: null,
          catalogNvMid: null,
          productName: null,
          page: currentPage,
          isAd: false,
          blocked: true,
          error: 'CAPTCHA',
        };
      }
    }

    await hydrateCurrentPage(page);

    const result = await findRankByProductIdOnPage(page, productId);

    if (result.found && result.pageRank) {
      // 실제 순위 계산: (페이지 - 1) * 40 + 페이지 내 순위
      const actualRank = (currentPage - 1) * 40 + result.pageRank;

      return {
        rank: actualRank,
        catalogNvMid: result.catalogNvMid,
        productName: result.productName,
        page: currentPage,
        isAd: result.isAd,
        blocked: false,
      };
    }

    if (currentPage < MAX_PAGES_PRODUCTID) {
      await delay(SAFE_DELAY_MS);
    }
  }

  return {
    rank: null,
    catalogNvMid: null,
    productName: null,
    page: null,
    isAd: false,
    blocked: false,
    error: `${MAX_PAGES_PRODUCTID}페이지까지 미발견`,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 기존 코드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 워커별 프로필 경로 (쿠키/세션 유지)
function getWorkerProfilePath(workerId: number): string {
  const profilePath = path.join(os.tmpdir(), `prb-rank-worker-${workerId}`);
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }
  return profilePath;
}

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
  blocked?: boolean;
}

export class ParallelRankChecker {
  /**
   * 단일 URL의 순위를 체크합니다 (Promise.all 내부에서 실행됨)
   *
   * ✅ ProductId 방식만 사용:
   * - URL에서 productId 추출 → 네이버 검색 → DOM 매칭
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
    const logPrefix = `[${index + 1}]`;

    console.log(
      `${logPrefix} 🌐 브라우저 시작: ${request.url.substring(0, 60)}...`
    );

    let browser: any = null;
    let page: any = null;

    try {
      // 독립적인 브라우저 인스턴스 생성 (persistentContext)
      const userDataDir = getWorkerProfilePath(index);
      const connection = await connect({
        headless: false,  // Visible 모드 (네이버 봇 탐지 회피)
        turnstile: true,
        fingerprint: true,
        customConfig: {
          userDataDir: userDataDir,
        },
      });

      browser = connection.browser;
      page = connection.page;

      // ✅ about:blank 탭 정리 (무한 생성 버그 방지)
      try {
        const pages = await browser.pages();
        for (const p of pages) {
          if (p !== page && p.url() === 'about:blank') {
            await p.close().catch(() => {});
          }
        }
      } catch {}

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MID 추출: ProductId 방식 우선, 실패 시 Catalog 방식
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let productId = extractProductIdFromUrl(request.url);
      let mid: string | null = null;
      let midSource: 'direct' | 'catalog' | 'failed' = 'failed';

      if (productId) {
        console.log(`${logPrefix} 🚀 ProductId 방식: ${productId}`);
        mid = productId;
        midSource = 'direct';
      } else {
        // catalog/product URL인 경우 브라우저로 방문하여 MID 추출
        console.log(`${logPrefix} 📦 Catalog URL 감지, MID 추출 시도...`);
        const catalogResult = await getCatalogMidFromUrl(page, request.url);

        if (catalogResult.mid) {
          mid = catalogResult.mid;
          midSource = 'catalog';
          console.log(`${logPrefix} ✅ Catalog MID 추출: ${mid}`);
        } else {
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
      }

      if (!mid) {
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

      const result = await checkRankByProductId(page, request.keyword, mid, logPrefix);

      await browser.close();

      const duration = Date.now() - startTime;

      if (result.blocked) {
        console.log(`${logPrefix} 🛑 차단 감지됨`);
      } else if (result.rank) {
        console.log(`${logPrefix} ✅ 순위 발견: ${result.rank}위 (${Math.round(duration / 1000)}초)`);
      } else {
        console.log(`${logPrefix} ❌ ${result.error || '미발견'} (${Math.round(duration / 1000)}초)`);
      }

      // RankResult 형식으로 변환
      const rankResult: RankResult | null = result.rank ? {
        found: true,
        mid: result.catalogNvMid || mid,
        productName: result.productName || request.productName || '',
        totalRank: result.rank,
        organicRank: result.isAd ? -1 : result.rank,
        isAd: result.isAd,
        page: result.page || 1,
        pagePosition: result.rank % 40 || 40,
        blocked: result.blocked,
      } : null;

      return {
        url: request.url,
        keyword: request.keyword,
        productName: result.productName || request.productName,
        mid: result.catalogNvMid || mid,
        midSource: result.catalogNvMid ? 'catalog' : midSource,
        rank: rankResult,
        duration,
        blocked: result.blocked,
        error: result.error,
      };
    } catch (error: any) {
      console.log(`${logPrefix} ❌ 에러: ${error.message}`);

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
