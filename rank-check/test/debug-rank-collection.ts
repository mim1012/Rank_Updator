#!/usr/bin/env npx tsx
/**
 * 순위 수집 디버깅 - 실제로 어떤 순위가 수집되는지 확인
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  enterShoppingTab,
  hydrateCurrentPage,
  collectProductsOnPage,
  goToPageAndGetAPIData,
} from '../accurate-rank-checker';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const keyword = '키보드';
  const targetPage = 8; // 8페이지 (약 280-320위)

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 "${keyword}" ${targetPage}페이지 순위 수집 디버깅`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const userDataDir = path.join(os.tmpdir(), `debug-rank-${Date.now()}`);
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
    // 쇼핑탭 진입
    console.log('🧭 쇼핑탭 진입...\n');
    const ready = await enterShoppingTab(page, keyword);
    if (!ready) {
      throw new Error('쇼핑탭 진입 실패');
    }

    // API 방식으로 8페이지 수집
    console.log(`\n📄 ${targetPage}페이지 수집 (API 방식)...`);
    const apiResult = await goToPageAndGetAPIData(page, targetPage);

    if (apiResult && apiResult !== 'BLOCKED') {
      console.log(`\n✅ API 방식 성공: ${apiResult.length}개 상품`);

      // 순위 범위 확인
      const ranks = apiResult.map((p: any) => p.totalRank);
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);

      console.log(`   최소 순위: ${minRank}위`);
      console.log(`   최대 순위: ${maxRank}위`);

      // 300-400 범위 카운트
      const in300_400 = apiResult.filter((p: any) => p.totalRank >= 300 && p.totalRank <= 400);
      console.log(`   300-400위 상품: ${in300_400.length}개\n`);

      // 샘플 출력
      console.log('샘플 (처음 10개):');
      apiResult.slice(0, 10).forEach((p: any) => {
        console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 40)}`);
      });
    } else {
      console.log(`\n⚠️ API 방식 실패`);

      // DOM 방식으로 재시도
      console.log(`\n📄 DOM 방식으로 재시도...\n`);

      // URL 직접 이동
      const currentUrl = page.url();
      const newUrl = currentUrl.includes('pagingIndex=')
        ? currentUrl.replace(/pagingIndex=\d+/, `pagingIndex=${targetPage}`)
        : currentUrl + (currentUrl.includes('?') ? '&' : '?') + `pagingIndex=${targetPage}`;

      await page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(5000);

      await hydrateCurrentPage(page);
      const domScan = await collectProductsOnPage(page, targetPage);

      console.log(`✅ DOM 방식 성공: ${domScan.products.length}개 상품\n`);

      // 순위 범위 확인
      const ranks = domScan.products.map((p: any) => p.totalRank);
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);

      console.log(`   최소 순위: ${minRank}위`);
      console.log(`   최대 순위: ${maxRank}위`);

      // 300-400 범위 카운트
      const in300_400 = domScan.products.filter((p: any) => p.totalRank >= 300 && p.totalRank <= 400);
      console.log(`   300-400위 상품: ${in300_400.length}개\n`);

      // 샘플 출력
      console.log('샘플 (처음 10개):');
      domScan.products.slice(0, 10).forEach((p: any) => {
        console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 40)}`);
      });

      console.log('\n샘플 (마지막 10개):');
      domScan.products.slice(-10).forEach((p: any) => {
        console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 40)}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error: any) {
    console.error('❌ 에러:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
