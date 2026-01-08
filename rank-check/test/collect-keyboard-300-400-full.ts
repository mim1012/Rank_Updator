#!/usr/bin/env npx tsx
/**
 * "키보드" 300-400위 상품 100개 수집
 *
 * 올바른 플로우:
 * 1. 상품 검색 → 쇼핑탭
 * 2. 스크롤 (페이지네이션 버튼 보일 때까지)
 * 3. 페이지네이션으로 다음 페이지 이동
 * 4. 스크롤하면서 상품 수집
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
 * 1. 네이버 메인 → 검색 → 쇼핑탭
 */
async function enterShoppingTab(page: any, keyword: string): Promise<boolean> {
  console.log('🧭 네이버 메인 진입');
  await page.goto('https://www.naver.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await delay(SAFE_DELAY_MS);

  const searchInput = await page.waitForSelector('input[name="query"]', { timeout: 15000 });
  await searchInput.click({ clickCount: 3 });
  await humanType(page, keyword);
  await page.keyboard.press('Enter');

  console.log('⏳ 검색 결과 대기...');
  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch {}
  await delay(3000);

  console.log('🛒 쇼핑탭 클릭');

  // ✅ target="_blank" 제거 후 클릭 (parallel-rank-checker 방식)
  let clicked = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    clicked = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="search.shopping.naver.com"]');
      if (!link) return false;
      link.removeAttribute('target');  // ← 핵심: target 제거
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

  // 페이지 안정화 대기
  await delay(2000);

  try {
    if (await isBlocked(page)) {
      console.log('🛑 보안 페이지 감지');
      return false;
    }
  } catch (err) {
    console.log('⚠️ 페이지 컨텍스트 에러 (무시)');
    await delay(2000);
  }

  console.log('✅ 쇼핑탭 진입 완료');
  return true;
}

/**
 * 2. 스크롤 (페이지네이션 버튼 보이게)
 */
async function scrollToPagination(page: any): Promise<void> {
  console.log('📜 페이지네이션 버튼까지 스크롤...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(1000);
  console.log('✅ 페이지네이션 버튼 보임');
}

/**
 * 3. 페이지네이션으로 다음 페이지 이동
 */
async function goToPage(page: any, targetPage: number): Promise<boolean> {
  const paginationSelector = 'a.pagination_btn_page__utqBz, a[class*="pagination_btn"]';

  try {
    await page.waitForSelector(paginationSelector, { timeout: 10000, visible: true });
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

  // API 응답 대기
  const apiResponsePromise = page.waitForResponse(
    (response: any) => {
      const url = response.url();
      return url.includes('/api/search/all') && url.includes(`pagingIndex=${targetPage}`);
    },
    { timeout: 30000 }
  ).catch(() => null);

  // 버튼 클릭
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
    console.log(`   🖱️ ${targetPage}페이지 버튼 클릭`);
  } catch {
    return false;
  }

  // API 응답 대기
  await apiResponsePromise;
  await delay(1500);

  console.log(`   ✅ ${targetPage}페이지 이동 완료`);
  return true;
}

/**
 * 4. 스크롤하면서 상품 수집
 */
async function scrollAndCollect(page: any, pageNumber: number): Promise<ProductData[]> {
  console.log(`   📜 스크롤하면서 상품 수집...`);

  // 스크롤 (lazy loading 트리거)
  await page.evaluate(() => window.scrollTo(0, 0));
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(1000);

  // 상품 수집 (pageNumber로 실제 순위 계산)
  const products = await page.evaluate((pageNum: number) => {
    const anchors = document.querySelectorAll('a[data-shp-contents-id][data-shp-contents-rank]');
    const result: any[] = [];
    const seen = new Set<string>();

    for (const anchor of anchors) {
      const mid = anchor.getAttribute('data-shp-contents-id');
      const rankStr = anchor.getAttribute('data-shp-contents-rank');

      if (!mid || !rankStr || seen.has(mid)) continue;

      const pageRank = parseInt(rankStr, 10);
      if (!Number.isFinite(pageRank)) continue;

      // ✅ 실제 순위 = (페이지 - 1) × 40 + 페이지 내 순위
      const actualRank = (pageNum - 1) * 40 + pageRank;

      // ✅ 상품명 추출 (accurate-rank-checker 방식)
      let productName = '상품명 없음';
      const titleAttr = anchor.getAttribute('title') || anchor.getAttribute('aria-label');
      if (titleAttr) {
        productName = titleAttr.trim();
      } else {
        // 부모 요소에서 상품 카드 찾기
        let parent: Element | null = anchor;
        for (let i = 0; i < 5 && parent; i++) {
          parent = parent.parentElement;
          if (!parent) break;

          const cls = parent.className || '';
          if (cls.includes('product_item') || cls.includes('basicList_item') || cls.includes('adProduct_item')) {
            const titleSelectors = [
              '.product_title__Mmw2K',
              '[class*="product_title"]',
              '[class*="basicList_title"]',
              'strong',
            ];
            for (const sel of titleSelectors) {
              const found = parent.querySelector(sel);
              if (found) {
                const text = found.getAttribute('title') || found.textContent;
                if (text && text.trim().length > 3) {
                  productName = text.replace(/\s+/g, ' ').trim().substring(0, 100);
                  break;
                }
              }
            }
            break;
          }
        }
      }

      const inventory = anchor.getAttribute('data-shp-inventory') || '';
      const isAd = /lst\*(A|P|D)/.test(inventory);

      result.push({
        mid,
        productName,
        totalRank: actualRank,  // ← 실제 순위 사용
        link_url: `https://search.shopping.naver.com/catalog/${mid}`,
        isAd,
      });

      seen.add(mid);
    }

    return result;
  }, pageNumber);

  return products;
}

/**
 * 메인 수집 로직
 */
async function collectProducts(page: any): Promise<ProductData[]> {
  console.log(`\n🎯 목표: 300~400위 상품 ${TARGET_COUNT}개\n`);

  // 1. 상품 검색 → 쇼핑탭
  const ready = await enterShoppingTab(page, KEYWORD);
  if (!ready) {
    throw new Error('쇼핑탭 진입 실패');
  }
  console.log('✅ 쇼핑탭 1페이지 도착\n');

  // 2. 스크롤 (페이지네이션 버튼 보이게)
  await scrollToPagination(page);
  console.log();

  const allProducts: ProductData[] = [];

  // 3. 페이지 순회 (8 → 9 → 10)
  for (let currentPage = START_PAGE; currentPage <= END_PAGE; currentPage++) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 ${currentPage}페이지 수집`);

    // 페이지 이동 (2페이지부터)
    if (currentPage > 1) {
      const randomDelay = 1000 + Math.random() * 1000;
      await delay(randomDelay);

      const moved = await goToPage(page, currentPage);
      if (!moved) {
        console.log(`   ⚠️ ${currentPage}페이지 이동 실패`);
        break;
      }

      if (await isBlocked(page)) {
        throw new Error('CAPTCHA 감지');
      }
    }

    // 4. 스크롤하면서 상품 수집 (pageNumber 전달)
    const products = await scrollAndCollect(page, currentPage);
    console.log(`   ✅ ${products.length}개 수집`);

    // 순위 범위 확인
    if (products.length > 0) {
      const ranks = products.map((p) => p.totalRank);
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);
      console.log(`   📊 순위 범위: ${minRank}위 ~ ${maxRank}위`);
    }

    // 300-400위 필터링
    const filtered = products.filter((p) => p.totalRank >= 300 && p.totalRank <= 400);
    console.log(`   📊 300-400위: ${filtered.length}개`);

    allProducts.push(...filtered);
    console.log(`   현재까지 수집: ${allProducts.length}개`);

    if (currentPage < END_PAGE) {
      await delay(SAFE_DELAY_MS);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 수집 완료: ${allProducts.length}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return allProducts;
}

/**
 * DB 저장
 */
async function saveToDatabase(products: ProductData[]) {
  console.log(`💾 slot_navertest에 ${products.length}개 저장 중...\n`);

  let successCount = 0;

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
        distributor: '일반',
        memo: `${product.totalRank}위`,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ ${product.totalRank}위 실패: ${error.message}`);
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
  console.log(`📊 저장: 성공 ${successCount}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * 메인
 */
async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 키보드 300-400위 상품 100개 수집`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 올바른 플로우:`);
  console.log(`   1. 상품 검색 → 쇼핑탭`);
  console.log(`   2. 스크롤 (페이지네이션 버튼 보이게)`);
  console.log(`   3. 페이지네이션으로 이동`);
  console.log(`   4. 스크롤하면서 상품 수집`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const userDataDir = path.join(os.tmpdir(), `kb-correct-${Date.now()}`);
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
    console.log(`   광고: ${products.filter((p) => p.isAd).length}개\n`);

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
