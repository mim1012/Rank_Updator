#!/usr/bin/env npx tsx
/**
 * "키보드" 키워드 1~100위권 상품 100개 수집
 *
 * 300-400위보다 페이지 이동이 적어서 CAPTCHA 회피 가능
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  enterShoppingTab,
  hydrateCurrentPage,
  collectProductsOnPage,
  goToPageAndGetAPIData,
  isBlocked,
} from '../accurate-rank-checker';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KEYWORD = '키보드';
const TARGET_COUNT = 100;
const START_RANK = 1;
const END_RANK = 100;

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

async function collectProducts(page: any): Promise<ProductData[]> {
  console.log(`\n🎯 순위 범위: ${START_RANK}위 ~ ${END_RANK}위 (목표: ${TARGET_COUNT}개)`);

  console.log(`\n🧭 키워드 "${KEYWORD}"로 쇼핑탭 진입 중...`);
  const ready = await enterShoppingTab(page, KEYWORD);
  if (!ready) {
    throw new Error('쇼핑탭 진입 실패');
  }
  console.log('✅ 쇼핑탭 진입 완료 (1페이지)\n');

  const startPage = Math.floor((START_RANK - 1) / 40) + 1; // 1
  const endPage = Math.ceil(END_RANK / 40);                 // 3

  console.log(`📄 수집 대상 페이지: ${startPage} ~ ${endPage}페이지\n`);

  const allProducts: ProductData[] = [];

  for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 ${currentPage}페이지 수집 중...`);

    let products: any[] = [];

    if (currentPage === 1) {
      await hydrateCurrentPage(page);
      const scan = await collectProductsOnPage(page, 1);
      products = scan.products;
      console.log(`   ✅ ${products.length}개 상품 수집 (DOM 방식)`);
    } else {
      const result = await goToPageAndGetAPIData(page, currentPage);

      if (result === 'BLOCKED') {
        console.error('   🛑 차단 감지! 수집 중단');
        throw new Error('보안 페이지 감지 - 차단됨');
      }

      if (result) {
        products = result;
        console.log(`   ✅ ${products.length}개 상품 수집 (API 방식)`);
      } else {
        console.warn(`   ⚠️ ${currentPage}페이지 수집 실패, 건너뜀`);
      }
    }

    for (const product of products) {
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

    console.log(`   현재까지 수집 (1-100위): ${allProducts.length}개`);

    if (currentPage < endPage) {
      const delayMs = 5000 + Math.random() * 2000;
      console.log(`   ⏳ ${(delayMs / 1000).toFixed(1)}초 대기 중...`);
      await delay(delayMs);
    }

    if (await isBlocked(page)) {
      console.error('   🛑 보안 페이지 감지! 즉시 중단');
      throw new Error('CAPTCHA 또는 보안 페이지 감지');
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 수집 완료: ${allProducts.length}개 상품`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return allProducts;
}

async function saveToSlotNavertest(products: ProductData[]) {
  console.log(`\n💾 slot_navertest에 ${products.length}개 상품 저장 중...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    const { error } = await supabase
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
        memo: `${product.totalRank}위 - ${product.productName.substring(0, 50)}`,
      });

    if (error) {
      console.error(`   ❌ 저장 실패 (${product.totalRank}위):`, error.message);
      failCount++;
    } else {
      console.log(`   ✅ ${product.totalRank}위: ${product.productName.substring(0, 40)}`);
      successCount++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 저장 결과: 성공 ${successCount}개 / 실패 ${failCount}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 키보드 1-100위 상품 수집`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   키워드: "${KEYWORD}"`);
  console.log(`   범위: ${START_RANK}~${END_RANK}위`);
  console.log(`   목표: ${TARGET_COUNT}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const userDataDir = path.join(os.tmpdir(), `collect-keyboard-1-100-${Date.now()}`);

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

    console.log(`\n📊 수집 결과 요약:`);
    console.log(`   총 ${products.length}개 상품`);
    console.log(`   광고 상품: ${products.filter((p) => p.isAd).length}개`);
    console.log(`   오가닉 상품: ${products.filter((p) => !p.isAd).length}개\n`);

    if (products.length > 0) {
      await saveToSlotNavertest(products);
    }

    console.log(`\n✅ 모든 작업 완료!\n`);
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
