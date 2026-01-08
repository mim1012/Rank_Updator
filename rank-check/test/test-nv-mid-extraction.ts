#!/usr/bin/env npx tsx
/**
 * nv_mid 추출 로직 테스트
 *
 * 광고 상품과 일반 상품의 MID가 올바르게 추출되는지 검증
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import { collectProductsOnPage, enterShoppingTab, hydrateCurrentPage } from '../accurate-rank-checker';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const KEYWORD = '키보드';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 nv_mid 추출 로직 테스트`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const userDataDir = path.join(os.tmpdir(), `test-nv-mid-${Date.now()}`);
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

  try {
    // 1. 쇼핑탭 진입
    console.log(`🔍 "${KEYWORD}" 키워드로 검색 중...\n`);
    const ready = await enterShoppingTab(page, KEYWORD);
    if (!ready) {
      throw new Error('쇼핑탭 진입 실패');
    }

    await delay(3000);

    // 2. 상품 수집
    await hydrateCurrentPage(page);
    const result = await collectProductsOnPage(page, 1);

    console.log(`✅ 수집 완료: ${result.products.length}개 상품\n`);

    // 3. 광고 상품과 일반 상품 분류
    const adProducts = result.products.filter((p) => p.isAd);
    const organicProducts = result.products.filter((p) => !p.isAd);

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 수집 결과`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   전체: ${result.products.length}개`);
    console.log(`   광고: ${adProducts.length}개`);
    console.log(`   일반: ${organicProducts.length}개\n`);

    // 4. 광고 상품 MID 검증
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 광고 상품 MID 검증 (상위 5개)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    adProducts.slice(0, 5).forEach((product, idx) => {
      const midType = product.mid.startsWith('nad-') ? '❌ 광고ID' : '✅ nv_mid';
      const midFormat = /^\d{10,}$/.test(product.mid) ? '(숫자)' : '(텍스트)';

      console.log(`${idx + 1}. [광고] ${product.totalRank}위`);
      console.log(`   ${midType}: ${product.mid} ${midFormat}`);
      console.log(`   상품명: ${product.productName.substring(0, 50)}`);
      console.log(``);
    });

    // 5. 일반 상품 MID 검증
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 일반 상품 MID 검증 (상위 5개)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    organicProducts.slice(0, 5).forEach((product, idx) => {
      const midType = product.mid.startsWith('nad-') ? '❌ 광고ID' : '✅ nv_mid';
      const midFormat = /^\d{10,}$/.test(product.mid) ? '(숫자)' : '(텍스트)';

      console.log(`${idx + 1}. [일반] ${product.totalRank}위`);
      console.log(`   ${midType}: ${product.mid} ${midFormat}`);
      console.log(`   상품명: ${product.productName.substring(0, 50)}`);
      console.log(``);
    });

    // 6. 오류 검증
    const invalidMids = result.products.filter((p) => p.mid.startsWith('nad-'));

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 검증 결과`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (invalidMids.length === 0) {
      console.log(`✅ 모든 상품의 MID가 올바르게 추출되었습니다!`);
      console.log(`   - 광고 상품: ${adProducts.length}개 → nv_mid 추출 성공`);
      console.log(`   - 일반 상품: ${organicProducts.length}개 → data-shp-contents-id 사용`);
    } else {
      console.log(`❌ ${invalidMids.length}개 상품에서 광고 ID가 검출되었습니다:`);
      invalidMids.forEach((p) => {
        console.log(`   - ${p.totalRank}위: ${p.mid}`);
      });
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error: any) {
    console.error(`\n❌ 에러 발생:`, error.message);
    process.exit(1);
  } finally {
    await browser.close();
    console.log(`🔚 테스트 완료\n`);
  }
}

main().catch((error) => {
  console.error('❌ 치명적 에러:', error);
  process.exit(1);
});
