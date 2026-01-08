#!/usr/bin/env npx tsx
/**
 * "키보드" 키워드 300~400위 상품 수집 (API 방식)
 *
 * ✅ 성공 패턴:
 * 1. correct-flow의 enterShoppingTab (성공 확인)
 * 2. API 인터셉트로 정확한 페이지별 데이터 수집
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  goToPageAndGetAPIData,
  hydrateCurrentPage,
  collectProductsOnPage,
  isBlocked,
} from '../accurate-rank-checker';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KEYWORD = '키보드';
const START_RANK = 300;
const END_RANK = 400;
const START_PAGE = 8;  // 300위는 8페이지 시작
const END_PAGE = 10;   // 400위는 10페이지 끝

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

/**
 * 자연스러운 타이핑
 */
async function humanType(page: any, text: string) {
  for (const char of text) {
    await page.keyboard.type(char);
    await delay(50 + Math.random() * 100);
  }
}

/**
 * 쇼핑탭 진입 (correct-flow의 성공 방식)
 */
async function enterShoppingTab(page: any, keyword: string): Promise<boolean> {
  console.log(`🧭 네이버 메인 진입`);
  await page.goto('https://www.naver.com/', { waitUntil: 'domcontentloaded' });
  await delay(2000);

  // 검색
  const searchInput = await page.waitForSelector('input[name="query"]', { timeout: 10000 });
  await searchInput.click({ clickCount: 3 });
  await delay(500);
  await humanType(page, keyword);
  await delay(500);
  await page.keyboard.press('Enter');

  console.log(`⏳ 검색 결과 대기...`);
  await delay(3000);

  // 쇼핑탭 클릭 (target 제거)
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
    console.log(`   ⚠️ 재시도 ${attempt}/5...`);
    await delay(2000);
  }

  if (!clicked) {
    console.error(`❌ 쇼핑탭 링크를 찾을 수 없습니다.`);
    return false;
  }

  await delay(3000);

  // 컨텍스트 에러 무시하고 URL 확인
  try {
    if (await isBlocked(page)) {
      return false;
    }
  } catch (err) {
    console.log(`⚠️ 페이지 컨텍스트 에러 (무시)`);
    await delay(2000);
  }

  const currentUrl = page.url();
  if (!currentUrl.includes('search.shopping.naver.com')) {
    console.error(`⚠️ 쇼핑탭 URL이 확인되지 않았습니다.`);
    return false;
  }

  console.log(`✅ 쇼핑탭 진입 완료`);
  console.log(`✅ 쇼핑탭 1페이지 도착\n`);
  return true;
}

/**
 * API 방식으로 페이지별 상품 수집
 */
async function collectProductsAPI(page: any): Promise<ProductData[]> {
  console.log(`\n🎯 순위 범위: ${START_RANK}위 ~ ${END_RANK}위`);
  console.log(`📄 페이지 범위: ${START_PAGE} ~ ${END_PAGE}페이지\n`);

  // 1. 쇼핑탭 진입
  const ready = await enterShoppingTab(page, KEYWORD);
  if (!ready) {
    throw new Error('쇼핑탭 진입 실패');
  }

  // 2. 1페이지 스크롤 (페이지네이션 버튼 보이게)
  console.log(`📜 페이지네이션까지 스크롤...\n`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1000);

  // 18단계 스크롤
  for (let i = 0; i < 18; i++) {
    await page.evaluate((step: number) => {
      window.scrollBy(0, 550);
    }, i);
    await delay(100);
  }
  await delay(1000);

  const allProducts: ProductData[] = [];

  // 3. 8, 9, 10 페이지 API 방식으로 수집
  for (let currentPage = START_PAGE; currentPage <= END_PAGE; currentPage++) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 ${currentPage}페이지 수집 (API 방식)`);

    // API 인터셉트로 상품 수집
    const result = await goToPageAndGetAPIData(page, currentPage);

    if (result === 'BLOCKED') {
      console.error(`   🛑 차단 감지! 수집 중단`);
      throw new Error('보안 페이지 감지');
    }

    if (!result || result.length === 0) {
      console.warn(`   ⚠️ ${currentPage}페이지 데이터 없음`);
      continue;
    }

    console.log(`   ✅ ${result.length}개 상품 수집`);

    // 300-400위 범위 필터링
    for (const product of result) {
      if (product.totalRank >= START_RANK && product.totalRank <= END_RANK) {
        allProducts.push({
          mid: product.mid,
          productName: product.productName,
          link_url: `https://search.shopping.naver.com/catalog/${product.mid}`,
          totalRank: product.totalRank,
          isAd: product.isAd,
        });
      }
    }

    console.log(`   현재까지 수집 (300-400위): ${allProducts.length}개`);

    // 안정화 딜레이
    if (currentPage < END_PAGE) {
      const delayMs = 5000 + Math.random() * 2000;
      console.log(`   ⏳ ${(delayMs / 1000).toFixed(1)}초 대기...`);
      await delay(delayMs);
    }

    // 차단 체크
    if (await isBlocked(page)) {
      throw new Error('보안 페이지 감지');
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
  console.log(`🎯 키보드 300-400위 상품 수집 (API 방식)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   키워드: "${KEYWORD}"`);
  console.log(`   범위: ${START_RANK}~${END_RANK}위`);
  console.log(`   페이지: ${START_PAGE}~${END_PAGE}`);
  console.log(`   customer_id: test11`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📝 방식: API 인터셉트 (정확한 페이지별 데이터)\n`);

  // 브라우저 실행
  console.log('🚀 브라우저 실행 중...');
  const userDataDir = path.join(os.tmpdir(), `collect-keyboard-api-${Date.now()}`);
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
    // 상품 수집
    const products = await collectProductsAPI(page);

    // 결과 출력
    console.log(`📊 수집 결과:`);
    console.log(`   총 ${products.length}개 상품`);
    console.log(`   광고: ${products.filter((p) => p.isAd).length}개`);
    console.log(`   오가닉: ${products.filter((p) => !p.isAd).length}개\n`);

    // 샘플
    console.log(`샘플 (처음 10개):`);
    products.slice(0, 10).forEach((p) => {
      console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 50)}`);
    });
    if (products.length > 10) {
      console.log(`   ... 외 ${products.length - 10}개\n`);
    }

    // DB 저장
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
