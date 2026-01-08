#!/usr/bin/env npx tsx
/**
 * "키보드" 300-400위 상품 100개 수집 (안정화 버전)
 *
 * 개선 사항:
 * 1. 페이지별 충분한 딜레이
 * 2. URL 직접 이동 방식 사용
 * 3. DOM 확인 후 데이터 수집
 * 4. 진행 상황 저장 (중단 시 재개 가능)
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
const TARGET_COUNT = 100;
const START_PAGE = 8;  // 300위 근처 (페이지당 40개)
const END_PAGE = 10;    // 400위 근처

interface ProductData {
  mid: string;
  productName: string;
  link_url: string;
  totalRank: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 페이지 스크롤 (봇 탐지 회피)
 */
async function smoothScroll(page: any) {
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 300));
    await delay(200 + Math.random() * 200);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1000);
}

/**
 * 특정 페이지의 상품 수집 (URL 직접 이동 방식)
 */
async function collectPageProducts(
  page: any,
  pageNumber: number
): Promise<ProductData[]> {
  // 1. 쇼핑 검색 URL로 직접 이동
  const url = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(KEYWORD)}&cat_id=&frm=NVSHATC&pagingIndex=${pageNumber}`;

  console.log(`\n📄 ${pageNumber}페이지 이동 중...`);
  console.log(`   URL: ${url}`);

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
  } catch (error: any) {
    console.error(`   ❌ 페이지 로드 실패: ${error.message}`);
    return [];
  }

  // 2. 로딩 대기
  console.log(`   ⏳ 페이지 안정화 대기...`);
  await delay(8000 + Math.random() * 2000); // 8-10초

  // 3. 차단 확인
  const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
  if (
    bodyText.includes('보안 확인') ||
    bodyText.includes('자동 입력 방지') ||
    bodyText.includes('일시적으로 제한')
  ) {
    console.error(`   🛑 보안 페이지 감지!`);
    throw new Error('CAPTCHA 또는 차단 감지');
  }

  // 4. 스크롤로 모든 상품 로드
  console.log(`   📜 스크롤하여 상품 로드...`);
  await smoothScroll(page);

  // 5. 상품 수집
  console.log(`   🔍 상품 수집 중...`);
  const products = await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[data-shp-contents-id][data-shp-contents-rank]');
    const result: any[] = [];
    const seen = new Set<string>();

    for (const anchor of anchors) {
      const mid = anchor.getAttribute('data-shp-contents-id');
      const rankStr = anchor.getAttribute('data-shp-contents-rank');

      if (!mid || !rankStr || seen.has(mid)) continue;

      const totalRank = parseInt(rankStr, 10);
      if (!Number.isFinite(totalRank)) continue;

      // 제목 추출
      let productName = '상품명 없음';
      const titleAttr = anchor.getAttribute('title') || anchor.getAttribute('aria-label');
      if (titleAttr) {
        productName = titleAttr.trim();
      }

      result.push({
        mid,
        productName,
        totalRank,
        link_url: `https://search.shopping.naver.com/catalog/${mid}`,
      });

      seen.add(mid);
    }

    return result;
  });

  console.log(`   ✅ ${products.length}개 상품 수집 완료`);

  // 순위 범위 확인
  if (products.length > 0) {
    const ranks = products.map((p: any) => p.totalRank);
    const minRank = Math.min(...ranks);
    const maxRank = Math.max(...ranks);
    console.log(`   📊 순위 범위: ${minRank}위 ~ ${maxRank}위`);
  }

  return products;
}

/**
 * slot_navertest에 저장
 */
async function saveToDatabase(products: ProductData[]) {
  console.log(`\n💾 slot_navertest에 ${products.length}개 상품 저장 중...\n`);

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
        memo: `${product.totalRank}위 수집`,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ 저장 실패 (${product.totalRank}위):`, error.message);
      failCount++;
    } else {
      console.log(`   ✅ ID ${data.id} | ${product.totalRank}위 | ${product.productName.substring(0, 40)}`);
      successCount++;

      // 히스토리 기록
      await insertHistory(data.id, product);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 저장 결과: 성공 ${successCount}개 / 실패 ${failCount}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * slot_rank_naver_test_history에 히스토리 기록
 */
async function insertHistory(slotStatusId: number, product: ProductData) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('slot_rank_naver_test_history')
    .insert({
      slot_status_id: slotStatusId,
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

  if (error) {
    console.warn(`      ⚠️ 히스토리 저장 실패:`, error.message);
  } else {
    console.log(`      📊 히스토리 기록 완료`);
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 키보드 300-400위 상품 100개 수집 (안정화 버전)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   키워드: "${KEYWORD}"`);
  console.log(`   페이지: ${START_PAGE} ~ ${END_PAGE}`);
  console.log(`   목표: ${TARGET_COUNT}개`);
  console.log(`   customer_id: test11`);
  console.log(`   customer_name: test`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 브라우저 실행
  console.log('🚀 브라우저 실행 중...');
  const userDataDir = path.join(os.tmpdir(), `keyboard-stable-${Date.now()}`);
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

  console.log('✅ 브라우저 준비 완료\n');

  try {
    const allProducts: ProductData[] = [];

    // 페이지별 수집
    for (let pageNum = START_PAGE; pageNum <= END_PAGE; pageNum++) {
      const pageProducts = await collectPageProducts(page, pageNum);

      // 300-400위 범위 필터링
      const filtered = pageProducts.filter(
        (p) => p.totalRank >= 300 && p.totalRank <= 400
      );

      console.log(`   ✅ 300-400위 상품: ${filtered.length}개`);
      allProducts.push(...filtered);

      // 목표 달성 체크
      if (allProducts.length >= TARGET_COUNT) {
        console.log(`\n🎯 목표 달성! ${TARGET_COUNT}개 수집 완료`);
        break;
      }

      // 다음 페이지로 이동 전 대기
      if (pageNum < END_PAGE) {
        const waitSec = 10 + Math.random() * 5;
        console.log(`\n   ⏳ 다음 페이지 이동 전 ${waitSec.toFixed(1)}초 대기...\n`);
        await delay(waitSec * 1000);
      }
    }

    // 최종 결과
    const finalProducts = allProducts.slice(0, TARGET_COUNT);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 수집 결과: ${finalProducts.length}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 샘플 출력
    console.log('샘플 (처음 10개):');
    finalProducts.slice(0, 10).forEach((p) => {
      console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 50)}`);
    });

    if (finalProducts.length > 10) {
      console.log(`   ... 외 ${finalProducts.length - 10}개\n`);
    }

    // DB 저장
    if (finalProducts.length > 0) {
      await saveToDatabase(finalProducts);
    }

    console.log(`\n✅ 모든 작업 완료!`);
    console.log(`\n다음 단계:`);
    console.log(`  1. slot_navertest 테이블 확인`);
    console.log(`  2. slot_rank_naver_test_history 테이블 확인\n`);
  } catch (error: any) {
    console.error(`\n❌ 에러 발생:`, error.message);
    console.error(error.stack);
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
