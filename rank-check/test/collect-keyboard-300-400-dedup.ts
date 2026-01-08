#!/usr/bin/env npx tsx
/**
 * "키보드" 키워드 300~400위 상품 수집 (중복 제거)
 *
 * ✅ 성공 패턴 + 중복 제거:
 * 1. 상품 검색 → 쇼핑탭
 * 2. 스크롤 (페이지네이션 버튼 보이게)
 * 3. 페이지네이션으로 이동
 * 4. 스크롤하면서 상품 수집
 * 5. MID 기준 중복 제거 (가장 낮은 순위 유지)
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KEYWORD = '키보드';
const START_PAGE = 8;
const END_PAGE = 12;  // 400위까지 확실히 수집하기 위해 12페이지까지
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

async function humanType(page: any, text: string) {
  for (const char of text) {
    await page.keyboard.type(char);
    await delay(50 + Math.random() * 100);
  }
}

async function humanScroll(page: any, totalDistance: number) {
  const steps = 18;
  const stepSize = totalDistance / steps;

  for (let i = 0; i < steps; i++) {
    await page.evaluate((distance: number) => {
      window.scrollBy(0, distance);
    }, stepSize);
    await delay(100);
  }
}

async function isBlocked(page: any): Promise<boolean> {
  try {
    const html = await page.content();
    return (
      html.includes('입력하신 내용을 다시 확인해주세요') ||
      html.includes('보안문자') ||
      html.includes('CAPTCHA')
    );
  } catch {
    return false;
  }
}

/**
 * 쇼핑탭 진입
 */
async function enterShoppingTab(page: any, keyword: string): Promise<boolean> {
  console.log(`🧭 네이버 메인 진입`);
  await page.goto('https://www.naver.com/');
  await delay(2000);

  const searchInput = await page.waitForSelector('input[name="query"]');
  await searchInput.click({ clickCount: 3 });
  await delay(500);
  await humanType(page, keyword);
  await delay(500);
  await page.keyboard.press('Enter');

  console.log(`⏳ 검색 결과 대기...`);
  await delay(3000);

  console.log(`🛒 쇼핑탭 클릭`);
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
    return false;
  }

  await delay(3000);

  try {
    if (await isBlocked(page)) return false;
  } catch {
    console.log(`⚠️ 페이지 컨텍스트 에러 (무시)`);
    await delay(2000);
  }

  const currentUrl = page.url();
  if (!currentUrl.includes('search.shopping.naver.com')) {
    return false;
  }

  console.log(`✅ 쇼핑탭 진입 완료`);
  return true;
}

/**
 * 페이지네이션까지 스크롤
 */
async function scrollToPagination(page: any) {
  console.log(`📜 페이지네이션 버튼까지 스크롤...`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1000);
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(1000);
  console.log(`✅ 페이지네이션 버튼 보임`);
}

/**
 * 페이지 이동
 */
async function goToPage(page: any, targetPage: number): Promise<boolean> {
  console.log(`   🖱️ ${targetPage}페이지 버튼 클릭`);

  const clicked = await page.evaluate((nextPage: number) => {
    const buttons = document.querySelectorAll('a.pagination_btn_page__utqBz');
    for (const btn of buttons) {
      if (btn.textContent?.trim() === String(nextPage)) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  }, targetPage);

  if (!clicked) {
    return false;
  }

  await delay(3000);
  console.log(`   ✅ ${targetPage}페이지 이동 완료`);
  return true;
}

/**
 * 스크롤하면서 상품 수집
 */
async function scrollAndCollect(page: any, pageNumber: number): Promise<ProductData[]> {
  console.log(`   📜 스크롤하면서 상품 수집...`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1000);
  await humanScroll(page, SCROLL_STEPS * 550);
  await delay(1000);

  const products = await page.evaluate((pageNum: number) => {
    const anchors = document.querySelectorAll('a[data-shp-contents-id][data-shp-contents-rank]');
    const result: any[] = [];

    for (const anchor of anchors) {
      const mid = anchor.getAttribute('data-shp-contents-id');
      const pageRank = parseInt(anchor.getAttribute('data-shp-contents-rank')!, 10);
      const actualRank = (pageNum - 1) * 40 + pageRank;

      let productName = '상품명 없음';
      const titleAttr = anchor.getAttribute('title') || anchor.getAttribute('aria-label');
      if (titleAttr) {
        productName = titleAttr.trim();
      } else {
        let parent: Element | null = anchor;
        for (let i = 0; i < 5 && parent; i++) {
          parent = parent.parentElement;
          if (parent) {
            const titleElem = parent.querySelector('[class*="product_title"]');
            if (titleElem?.textContent) {
              productName = titleElem.textContent.trim();
              break;
            }
          }
        }
      }

      const isAd = /lst\*(A|P|D)/.test(anchor.getAttribute('data-shp-inventory') || '');

      result.push({
        mid,
        productName,
        totalRank: actualRank,
        link_url: `https://search.shopping.naver.com/catalog/${mid}`,
        isAd,
      });
    }

    return result;
  }, pageNumber);

  return products;
}

/**
 * 상품 수집 (순위별 중복 제거)
 */
async function collectProducts(page: any): Promise<ProductData[]> {
  console.log(`\n🎯 목표: 300~400위 정확히 101개 (순위별 첫 상품만)\n`);

  const ready = await enterShoppingTab(page, KEYWORD);
  if (!ready) {
    throw new Error('쇼핑탭 진입 실패');
  }
  console.log('✅ 쇼핑탭 1페이지 도착\n');

  await scrollToPagination(page);
  console.log();

  // Map으로 중복 제거 (key: 순위, value: ProductData)
  const rankMap = new Map<number, ProductData>();

  for (let currentPage = START_PAGE; currentPage <= END_PAGE; currentPage++) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 ${currentPage}페이지 수집`);

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

    const products = await scrollAndCollect(page, currentPage);
    console.log(`   ✅ ${products.length}개 수집`);

    if (products.length > 0) {
      const ranks = products.map((p) => p.totalRank);
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);
      console.log(`   📊 순위 범위: ${minRank}위 ~ ${maxRank}위`);
    }

    // 300-400위 필터링 + 순위별 중복 제거 (각 순위의 첫 번째 상품만)
    for (const product of products) {
      if (product.totalRank >= 300 && product.totalRank <= 400) {
        if (!rankMap.has(product.totalRank)) {
          rankMap.set(product.totalRank, product);
        }
      }
    }

    console.log(`   📊 300-400위 (순위별 중복 제거): ${rankMap.size}개`);

    // 101개 달성 시 조기 종료
    if (rankMap.size >= 101) {
      console.log(`\n🎯 목표 달성! 101개 수집 완료`);
      break;
    }

    if (currentPage < END_PAGE) {
      await delay(SAFE_DELAY_MS);
    }
  }

  const allProducts = Array.from(rankMap.values());
  allProducts.sort((a, b) => a.totalRank - b.totalRank);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 수집 완료: ${allProducts.length}개 (순위별 중복 제거)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return allProducts;
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
        distributor: '일반',
        memo: `${product.totalRank}위 - ${product.productName.substring(0, 50)}`,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ 저장 실패 (${product.totalRank}위):`, error.message);
      failCount++;
    } else {
      console.log(`   ✅ ID ${data.id} | ${product.totalRank}위 | ${product.productName.substring(0, 40)}`);
      successCount++;

      // 히스토리 저장
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
  console.log(`📊 저장 결과: 성공 ${successCount}개 / 실패 ${failCount}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * 메인 실행
 */
async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 키보드 300-400위 상품 수집 (중복 제거)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   키워드: "${KEYWORD}"`);
  console.log(`   범위: 300~400위`);
  console.log(`   페이지: ${START_PAGE}~${END_PAGE}`);
  console.log(`   중복 제거: MID 기준 (가장 낮은 순위 유지)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log('🚀 브라우저 실행 중...');
  const userDataDir = path.join(os.tmpdir(), `collect-keyboard-dedup-${Date.now()}`);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const connection = await connect({
    headless: false,
    turnstile: true,
    fingerprint: true,
    customConfig: { userDataDir },
  });

  const browser = connection.browser;
  const page = connection.page;
  console.log('✅ 브라우저 준비 완료\n');

  try {
    const products = await collectProducts(page);

    console.log(`📊 수집 결과:`);
    console.log(`   총 ${products.length}개 (중복 제거됨)`);
    console.log(`   광고: ${products.filter((p) => p.isAd).length}개`);
    console.log(`   오가닉: ${products.filter((p) => !p.isAd).length}개\n`);

    console.log(`샘플 (처음 10개):`);
    products.slice(0, 10).forEach((p) => {
      console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 50)}`);
      console.log(`         MID: ${p.mid}`);
    });
    if (products.length > 10) {
      console.log(`   ... 외 ${products.length - 10}개\n`);
    }

    if (products.length > 0) {
      await saveToDatabase(products);
    }

    console.log(`\n✅ 모든 작업 완료!`);
  } catch (error: any) {
    console.error(`\n❌ 에러 발생:`, error.message);
    process.exit(1);
  } finally {
    await browser.close();
    console.log(`🔚 브라우저 종료\n`);
  }
}

main().catch((error) => {
  console.error('❌ 치명적 에러:', error);
  process.exit(1);
});
