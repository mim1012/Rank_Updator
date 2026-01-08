#!/usr/bin/env npx tsx
/**
 * "키보드" 300-400위 상품 100개 수집
 *
 * ✅ parallel-rank-checker 방식 사용:
 * - hydrateCurrentPage (humanScroll)
 * - goToNextPageForProductId (페이지네이션)
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { humanScroll, humanType } from '../utils/humanBehavior';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KEYWORD = '키보드';
const TARGET_COUNT = 100;
const START_PAGE = 8;
const END_PAGE = 10;
const SAFE_DELAY_MS = 5000;
const SCROLL_STEPS = 18;

interface ProductData {
  mid: string;
  productName: string;
  link_url: string;
  totalRank: number;
  isAd: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * ✅ parallel-rank-checker 방식: 스크롤로 lazy loading 트리거
 */
async function hydrateCurrentPage(page: any): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(600);
}

/**
 * ✅ parallel-rank-checker 방식: 페이지네이션으로 다음 페이지 이동
 */
async function goToNextPage(page: any, targetPage: number): Promise<boolean> {
  const paginationSelector = 'a.pagination_btn_page__utqBz, a[class*="pagination_btn"]';

  try {
    await page.waitForSelector(paginationSelector, { timeout: 10000, visible: true });
    console.log(`   ✅ 페이지네이션 버튼 로드`);
  } catch {
    console.log(`   ⚠️ 페이지네이션 버튼 없음`);
    return false;
  }

  const buttonExists = await page.evaluate((nextPage: number) => {
    const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz, a[class*="pagination_btn"]');
    for (const btn of buttons) {
      if (btn.textContent?.trim() === String(nextPage)) return true;
    }
    return false;
  }, targetPage);

  if (!buttonExists) {
    console.log(`   ⚠️ ${targetPage}페이지 버튼 없음`);
    return false;
  }

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

    if (!pageButton) {
      console.log(`   ⚠️ 버튼 element 가져오기 실패`);
      return false;
    }

    await (pageButton.asElement() as any).click();
    console.log(`   🖱️ ${targetPage}페이지 버튼 클릭`);
  } catch (error: any) {
    console.log(`   ⚠️ 버튼 클릭 실패: ${error.message}`);
    return false;
  }

  try {
    await apiResponsePromise;
    console.log(`   ✅ API 응답 수신`);
  } catch {
    console.log(`   ⚠️ API 응답 타임아웃 (30초)`);
  }

  await delay(1500);
  return true;
}

/**
 * 현재 페이지에서 상품 수집
 */
async function collectProductsOnPage(page: any): Promise<ProductData[]> {
  return await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[data-shp-contents-id][data-shp-contents-rank]');
    const result: any[] = [];
    const seen = new Set<string>();

    for (const anchor of anchors) {
      const mid = anchor.getAttribute('data-shp-contents-id');
      const rankStr = anchor.getAttribute('data-shp-contents-rank');

      if (!mid || !rankStr || seen.has(mid)) continue;

      const totalRank = parseInt(rankStr, 10);
      if (!Number.isFinite(totalRank)) continue;

      let productName = '상품명 없음';
      const titleAttr = anchor.getAttribute('title') || anchor.getAttribute('aria-label');
      if (titleAttr) {
        productName = titleAttr.trim();
      }

      // 광고 여부 확인
      const inventory = anchor.getAttribute('data-shp-inventory') || '';
      const isAd = /lst\*(A|P|D)/.test(inventory);

      result.push({
        mid,
        productName,
        totalRank,
        link_url: `https://search.shopping.naver.com/catalog/${mid}`,
        isAd,
      });

      seen.add(mid);
    }

    return result;
  });
}

/**
 * 쇼핑탭 진입
 */
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
    await delay(2000);
  }

  if (!clicked) {
    console.log('❌ 쇼핑탭 링크 없음');
    return false;
  }

  await delay(SAFE_DELAY_MS + 800);

  // URL 체크 대신 차단 여부만 확인
  if (await isBlocked(page)) {
    console.log('🛑 보안 페이지 감지');
    return false;
  }

  // 실제 상품이 있는지 확인
  console.log('🔍 상품 데이터 확인 중...');
  await delay(2000);

  const hasProducts = await page.evaluate(() => {
    const products = document.querySelectorAll('a[data-shp-contents-id][data-shp-contents-rank]');
    return products.length > 0;
  });

  if (!hasProducts) {
    console.log('⚠️ 상품 데이터 없음 - 페이지 확인 필요');
    const currentUrl = page.url();
    console.log(`   현재 URL: ${currentUrl}`);
    return false;
  }

  console.log('✅ 상품 데이터 확인 완료');
  return true;
}

/**
 * 300-400위 상품 수집
 */
async function collectProducts(page: any): Promise<ProductData[]> {
  console.log(`\n🎯 목표: 300~400위 상품 ${TARGET_COUNT}개\n`);

  // 1. 쇼핑탭 진입
  const ready = await enterShoppingTab(page, KEYWORD);
  if (!ready) {
    throw new Error('쇼핑탭 진입 실패');
  }
  console.log('✅ 쇼핑탭 1페이지 도착\n');

  // ✅ 1페이지에서 스크롤하여 페이지네이션 버튼 로드
  console.log('📜 1페이지 스크롤하여 페이지네이션 버튼 로드...');
  await hydrateCurrentPage(page);
  await delay(2000);
  console.log('✅ 페이지네이션 준비 완료\n');

  const allProducts: ProductData[] = [];

  // 2. 페이지 순회
  for (let currentPage = 1; currentPage <= END_PAGE; currentPage++) {
    // START_PAGE 전까지는 건너뛰기
    if (currentPage < START_PAGE) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📄 ${currentPage}페이지 건너뛰기...`);

      if (currentPage > 1) {
        const moved = await goToNextPage(page, currentPage);
        if (!moved) {
          console.log(`   ⚠️ ${currentPage}페이지 이동 실패`);
          break;
        }
      }
      continue;
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 ${currentPage}페이지 수집 중...`);

    // 페이지 이동 (2페이지부터)
    if (currentPage > 1) {
      const randomDelay = 1000 + Math.random() * 1000;
      await delay(randomDelay);

      const moved = await goToNextPage(page, currentPage);
      if (!moved) {
        console.log(`   ⚠️ ${currentPage}페이지 이동 실패`);
        break;
      }

      if (await isBlocked(page)) {
        throw new Error('CAPTCHA 감지');
      }
    }

    // ✅ humanScroll로 상품 로드
    console.log(`   📜 스크롤하여 상품 로드...`);
    await hydrateCurrentPage(page);

    // 상품 수집
    console.log(`   🔍 상품 수집 중...`);
    const products = await collectProductsOnPage(page);
    console.log(`   ✅ ${products.length}개 수집`);

    // 순위 범위 확인
    if (products.length > 0) {
      const ranks = products.map((p) => p.totalRank);
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);
      console.log(`   📊 순위 범위: ${minRank}위 ~ ${maxRank}위`);
    }

    // 300-400위 범위 필터링
    const filtered = products.filter((p) => p.totalRank >= 300 && p.totalRank <= 400);
    console.log(`   📊 300-400위: ${filtered.length}개`);

    allProducts.push(...filtered);
    console.log(`   현재까지 수집: ${allProducts.length}개`);

    // 목표 달성 체크
    if (allProducts.length >= TARGET_COUNT) {
      console.log(`\n🎯 목표 달성! ${TARGET_COUNT}개 수집 완료`);
      break;
    }

    if (currentPage < END_PAGE) {
      await delay(SAFE_DELAY_MS);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 수집 완료: ${allProducts.length}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return allProducts.slice(0, TARGET_COUNT);
}

/**
 * DB 저장
 */
async function saveToDatabase(products: ProductData[]) {
  console.log(`💾 slot_navertest에 ${products.length}개 저장 중...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    const { data, error } = await supabase
      .from('slot_navertest')
      .insert({
        keyword: KEYWORD,
        link_url: product.link_url,
        mid: product.mid,
        product_name: product.productName,
        current_rank: product.totalRank,
        start_rank: product.totalRank,
        customer_id: 'test11',
        customer_name: 'test',
        slot_type: '네이버test',
        workgroup: '공통',
        distributor: '일반',
        memo: `${product.totalRank}위`,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ ${product.totalRank}위 실패:`, error.message);
      failCount++;
    } else {
      console.log(`   ✅ ID ${data.id} | ${product.totalRank}위 | ${product.productName.substring(0, 40)}`);
      successCount++;

      // 히스토리 기록
      const now = new Date().toISOString();
      await supabase.from('slot_rank_naver_test_history').insert({
        slot_status_id: data.id,
        keyword: KEYWORD,
        link_url: product.link_url,
        current_rank: product.totalRank,
        start_rank: product.totalRank,
        previous_rank: null,
        rank_change: null,
        rank_diff: null,
        start_rank_diff: 0,
        customer_id: 'test11',
        distributor: '일반',
        slot_type: '네이버test',
        rank_date: now,
        created_at: now,
      });
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 저장: 성공 ${successCount}개 / 실패 ${failCount}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * 메인
 */
async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 키보드 300-400위 상품 100개 수집`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ parallel-rank-checker 방식 사용`);
  console.log(`   - humanScroll (18단계 * 550px)`);
  console.log(`   - goToNextPage (페이지네이션)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const userDataDir = path.join(os.tmpdir(), `collect-kb-scroll-${Date.now()}`);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const connection = await connect({
    headless: false,
    turnstile: true,
    fingerprint: true,
    customConfig: {
      userDataDir: userDataDir,
    },
  });

  const browser = connection.browser;
  const page = connection.page;

  try {
    const products = await collectProducts(page);

    console.log(`📊 수집 결과:`);
    console.log(`   총 ${products.length}개`);
    console.log(`   광고: ${products.filter((p) => p.isAd).length}개`);
    console.log(`   오가닉: ${products.filter((p) => !p.isAd).length}개\n`);

    console.log(`샘플 (처음 10개):`);
    products.slice(0, 10).forEach((p) => {
      console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 50)}`);
    });

    if (products.length > 0) {
      await saveToDatabase(products);
    }

    console.log(`\n✅ 완료!\n`);
  } catch (error: any) {
    console.error(`\n❌ 에러:`, error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
