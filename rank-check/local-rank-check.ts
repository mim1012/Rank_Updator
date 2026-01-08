/**
 * 로컬 순위 체크 스크립트 (ProductId 방식)
 *
 * puppeteer-real-browser 사용 (서버용과 동일한 엔진)
 *
 * 사용법:
 *   npx tsx rank-check/local-rank-check.ts "키워드" "스마트스토어URL"
 *   npx tsx rank-check/local-rank-check.ts "키워드" "스마트스토어URL" --save  # DB 저장
 *
 * 예시:
 *   npx tsx rank-check/local-rank-check.ts "강아지 간식" "https://smartstore.naver.com/pettail/products/11877263807"
 *   npx tsx rank-check/local-rank-check.ts "CF360A" "https://smartstore.naver.com/onlyone1295/products/5304435864" --save
 */

import { connect } from 'puppeteer-real-browser';
import { createClient } from '@supabase/supabase-js';
import { humanScroll, humanType } from './utils/humanBehavior';
import { saveRankToSlotNaver, type RankResult as SaveRankResult } from './utils/save-rank-to-slot-naver';
import * as dotenv from 'dotenv';

dotenv.config();

// ============ 상수 ============
const SAFE_DELAY_MS = 5000;
const SCROLL_STEPS = 18;
const MAX_PAGES = 15;

// ============ 타입 ============
interface CheckResult {
  found: boolean;
  keyword: string;
  linkUrl: string;
  productId: string;
  totalRank: number;
  page: number;
  pagePosition: number;
  productName: string | null;
  isAd: boolean;
}

// ============ 유틸리티 ============
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractProductIdFromUrl(url: string): string | null {
  const match = url.match(/\/products\/(\d+)/);
  return match ? match[1] : null;
}

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

// ============ 쇼핑탭 진입 ============
async function enterShoppingTab(page: any, keyword: string): Promise<boolean> {
  console.log('🧭 네이버 메인 진입');
  try {
    await page.goto('https://www.naver.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
  } catch (error) {
    console.log('⚠️ 네이버 진입 실패');
    return false;
  }

  await delay(SAFE_DELAY_MS);

  const searchInput = await page.waitForSelector('input[name="query"]', { timeout: 15000 }).catch(() => null);
  if (!searchInput) {
    console.log('❌ 검색 입력창 없음');
    return false;
  }

  await searchInput.click({ clickCount: 3 });
  await humanType(page, keyword);
  await page.keyboard.press('Enter');

  console.log('⏳ 검색 결과 대기...');
  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch {}
  await delay(3000);

  console.log('🛒 쇼핑탭 이동');
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
    console.log(`   ⏳ 쇼핑탭 대기 중... (${attempt}/5)`);
    await delay(2000);
  }

  if (!clicked) {
    console.log('❌ 쇼핑탭 링크 없음');
    return false;
  }

  await delay(SAFE_DELAY_MS + 800);

  if (!page.url().includes('search.shopping.naver.com')) {
    console.log('⚠️ 쇼핑탭 URL 미확인');
    return false;
  }

  if (await isBlocked(page)) {
    console.log('🛑 보안 페이지 감지');
    return false;
  }

  return true;
}

// ============ 스크롤 ============
async function hydrateCurrentPage(page: any): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(600);
}

// ============ 페이지에서 순위 찾기 ============
async function findRankByProductIdOnPage(page: any, targetProductId: string): Promise<{
  found: boolean;
  pageRank: number | null;
  productName: string | null;
  mid: string | null;
  isAd: boolean;
}> {
  return await page.evaluate((targetId: string) => {
    const result = {
      found: false,
      pageRank: null as number | null,
      productName: null as string | null,
      mid: null as string | null,
      isAd: false,
    };

    const anchors = document.querySelectorAll('a[data-shp-contents-id][data-shp-contents-rank][data-shp-contents-dtl]');

    for (const anchor of anchors) {
      const mid = anchor.getAttribute('data-shp-contents-id');
      if (!mid || !/^\d{10,}$/.test(mid)) continue;

      const dtl = anchor.getAttribute('data-shp-contents-dtl');
      const rankStr = anchor.getAttribute('data-shp-contents-rank');
      const inventory = anchor.getAttribute('data-shp-inventory') || '';

      if (!dtl || !rankStr) continue;

      try {
        const normalized = dtl.replace(/&quot;/g, '"');
        const parsed = JSON.parse(normalized);

        if (!Array.isArray(parsed)) continue;

        let chnlProdNo: string | null = null;
        let prodName: string | null = null;

        for (const item of parsed) {
          if (item.key === 'chnl_prod_no' && item.value) {
            chnlProdNo = String(item.value);
          }
          if (item.key === 'prod_nm' && item.value) {
            prodName = String(item.value).substring(0, 60);
          }
        }

        if (chnlProdNo === targetId) {
          result.found = true;
          result.pageRank = parseInt(rankStr, 10);
          result.productName = prodName;
          result.mid = mid;
          result.isAd = /lst\*(A|P|D)/.test(inventory);
          return result;
        }
      } catch {}
    }

    return result;
  }, targetProductId);
}

// ============ 다음 페이지 이동 ============
async function goToNextPage(page: any, targetPage: number): Promise<boolean> {
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
  } catch {
    // API 응답 타임아웃 시 DOM이 업데이트되었는지 확인
    await delay(2000);
  }

  await delay(1500);
  return true;
}

// ============ DB 저장 ============
async function saveToDatabase(result: CheckResult): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    console.error('   .env 파일을 확인하세요.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // KeywordRecord 형태로 변환
  const keywordRecord = {
    id: 0, // 로컬 체크이므로 임시 ID
    keyword: result.keyword,
    link_url: result.linkUrl,
    slot_type: '네이버쇼핑',
    customer_id: 'local',
    customer_name: '로컬체크',
  };

  // RankResult 형태로 변환 (미발견 시 null)
  const rankResult: SaveRankResult | null = result.found ? {
    productName: result.productName || '',
    mid: result.productId,
    totalRank: result.totalRank,
    organicRank: result.totalRank,
    page: result.page,
    pagePosition: result.pagePosition,
    isAd: result.isAd,
  } : null;

  console.log('\n💾 DB 저장 중...');
  const saveResult = await saveRankToSlotNaver(supabase, keywordRecord, rankResult);

  if (saveResult.success) {
    console.log(`✅ DB 저장 완료 (slot_naver ID: ${saveResult.slotNaverId}, action: ${saveResult.action})`);
  } else {
    console.error(`❌ DB 저장 실패: ${saveResult.error}`);
  }
}

// ============ 메인 순위 체크 ============
async function checkRank(keyword: string, linkUrl: string, shouldSave: boolean): Promise<CheckResult> {
  const productId = extractProductIdFromUrl(linkUrl);

  if (!productId) {
    console.error('❌ URL에서 productId를 추출할 수 없습니다.');
    console.error('올바른 형식: https://smartstore.naver.com/xxx/products/12345678');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('  로컬 순위 체크 (ProductId 방식)');
  console.log('========================================');
  console.log(`키워드: ${keyword}`);
  console.log(`URL: ${linkUrl}`);
  console.log(`ProductId: ${productId}`);
  console.log(`DB 저장: ${shouldSave ? '예' : '아니오'}`);
  console.log('----------------------------------------\n');

  // puppeteer-real-browser 연결
  console.log('🌐 브라우저 시작...');
  const { page, browser } = await connect({
    headless: false,
    turnstile: true,
    args: ['--start-maximized'],
  });

  let checkResult: CheckResult = {
    found: false,
    keyword,
    linkUrl,
    productId,
    totalRank: -1,
    page: 0,
    pagePosition: 0,
    productName: null,
    isAd: false,
  };

  try {
    // 쇼핑탭 진입
    const shoppingReady = await enterShoppingTab(page, keyword);
    if (!shoppingReady) {
      const blocked = await isBlocked(page);
      console.log(blocked ? '🛑 보안 페이지로 차단됨' : '❌ 쇼핑탭 진입 실패');
      await browser.close();

      if (shouldSave) {
        await saveToDatabase(checkResult);
      }
      return checkResult;
    }

    // 페이지 순회
    for (let currentPage = 1; currentPage <= MAX_PAGES; currentPage++) {
      console.log(`\n[${currentPage}페이지] 스캔 중...`);

      if (currentPage > 1) {
        const randomDelay = 1000 + Math.random() * 1000;
        await delay(randomDelay);

        const moved = await goToNextPage(page, currentPage);
        if (!moved) {
          console.log(`   ⚠️ ${currentPage}페이지 이동 실패 (마지막 페이지)`);
          break;
        }

        if (await isBlocked(page)) {
          console.log('🛑 CAPTCHA 감지됨');
          break;
        }
      }

      await hydrateCurrentPage(page);

      const result = await findRankByProductIdOnPage(page, productId);

      if (result.found && result.pageRank) {
        const actualRank = (currentPage - 1) * 40 + result.pageRank;
        const pagePosition = result.pageRank;

        console.log('\n========================================');
        console.log('  ✅ 순위 발견!');
        console.log('========================================');
        console.log(`전체 순위: ${actualRank}위`);
        console.log(`페이지: ${currentPage}페이지 ${pagePosition}번째`);
        console.log(`상품명: ${result.productName || '알 수 없음'}`);
        console.log(`광고 여부: ${result.isAd ? '광고' : '일반'}`);
        console.log('========================================\n');

        checkResult = {
          found: true,
          keyword,
          linkUrl,
          productId,
          totalRank: actualRank,
          page: currentPage,
          pagePosition,
          productName: result.productName,
          isAd: result.isAd,
        };

        await browser.close();

        if (shouldSave) {
          await saveToDatabase(checkResult);
        }
        return checkResult;
      }

      if (currentPage < MAX_PAGES) {
        await delay(SAFE_DELAY_MS);
      }
    }

    console.log('\n========================================');
    console.log('  ❌ 순위 미발견');
    console.log('========================================');
    console.log(`${MAX_PAGES}페이지(${MAX_PAGES * 40}위) 내에서 찾지 못했습니다.`);
    console.log('========================================\n');

    await browser.close();

    if (shouldSave) {
      await saveToDatabase(checkResult);
    }
    return checkResult;

  } catch (error: any) {
    console.error('\n오류 발생:', error.message);
    await browser.close();

    if (shouldSave) {
      await saveToDatabase(checkResult);
    }
    throw error;
  }
}

// ============ CLI 실행 ============
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
사용법:
  npx tsx rank-check/local-rank-check.ts "키워드" "스마트스토어URL"
  npx tsx rank-check/local-rank-check.ts "키워드" "스마트스토어URL" --save  # DB 저장

예시:
  npx tsx rank-check/local-rank-check.ts "강아지 간식" "https://smartstore.naver.com/pettail/products/11877263807"
  npx tsx rank-check/local-rank-check.ts "CF360A" "https://smartstore.naver.com/onlyone1295/products/5304435864" --save
    `);
    process.exit(1);
  }

  const keyword = args[0];
  const linkUrl = args[1];
  const shouldSave = args.includes('--save');

  await checkRank(keyword, linkUrl, shouldSave);
}

main();
