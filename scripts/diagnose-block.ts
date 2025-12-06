/**
 * 차단 진단 스크립트
 *
 * 차단이 어느 시점에서 발생하는지, 어떤 페이지가 보이는지 확인
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import * as fs from 'fs';
import * as path from 'path';

const KEYWORDS = [
  '장난감',
  '텀블러',
  '운동화',
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkBlockStatus(page: any, stage: string): Promise<{ blocked: boolean; reason?: string }> {
  const result = await page.evaluate(() => {
    const bodyText = document.body?.innerText ?? "";
    const pageUrl = window.location.href;
    const pageTitle = document.title;

    // 정밀한 차단 키워드 (오탐 방지)
    const checks = {
      has보안확인: bodyText.includes("보안 확인"),
      has자동입력방지: bodyText.includes("자동 입력 방지"),
      has일시적제한: bodyText.includes("일시적으로 제한"),
      has로봇확인: bodyText.includes("로봇이 아닙니다") || bodyText.includes("I'm not a robot"),
      has비정상접근: bodyText.includes("비정상적인 접근"),
      has접속제한: bodyText.includes("접속이 제한"),
      hasCaptchaForm: !!document.querySelector('iframe[src*="captcha"]') || !!document.querySelector('[class*="captcha"]'),
    };

    return {
      pageUrl,
      pageTitle,
      checks,
      bodyPreview: bodyText.substring(0, 500),
    };
  });

  const isBlocked = Object.values(result.checks).some(v => v);
  const reasons = Object.entries(result.checks)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  console.log(`\n[${ stage }]`);
  console.log(`  URL: ${result.pageUrl}`);
  console.log(`  Title: ${result.pageTitle}`);
  console.log(`  Blocked: ${isBlocked ? '🛑 YES' : '✅ NO'}`);
  if (reasons.length > 0) {
    console.log(`  Reasons: ${reasons.join(', ')}`);
  }

  return { blocked: isBlocked, reason: reasons.join(', ') };
}

async function takeScreenshot(page: any, name: string): Promise<void> {
  const screenshotDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join(screenshotDir, `${name}_${timestamp}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 Screenshot: ${filepath}`);
}

async function diagnoseKeyword(page: any, browser: any, keyword: string, index: number): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 [${index + 1}] 키워드: "${keyword}"`);
  console.log('='.repeat(60));

  // Stage 1: 네이버 메인
  console.log('\n📍 Stage 1: 네이버 메인 접속');
  try {
    await page.goto('https://www.naver.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await delay(2000);

    const status1 = await checkBlockStatus(page, 'Stage 1: 네이버 메인');
    if (status1.blocked) {
      await takeScreenshot(page, `blocked_stage1_${keyword}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }

  // Stage 2: 검색어 입력
  console.log('\n📍 Stage 2: 검색어 입력');
  try {
    const searchInput = await page.waitForSelector('input[name="query"]', { timeout: 10000 });
    if (!searchInput) {
      console.log('  ❌ 검색창 없음');
      return false;
    }

    await searchInput.click({ clickCount: 3 });
    await page.keyboard.type(keyword, { delay: 80 });
    await page.keyboard.press('Enter');

    await delay(3000);

    const status2 = await checkBlockStatus(page, 'Stage 2: 검색 결과');
    if (status2.blocked) {
      await takeScreenshot(page, `blocked_stage2_${keyword}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }

  // Stage 3: 쇼핑탭 클릭
  console.log('\n📍 Stage 3: 쇼핑탭 클릭');
  try {
    const clicked = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="search.shopping.naver.com"]');
      if (!link) return false;
      link.removeAttribute('target');
      link.click();
      return true;
    });

    if (!clicked) {
      console.log('  ❌ 쇼핑탭 링크 없음');
      await takeScreenshot(page, `no_shopping_tab_${keyword}`);
      return false;
    }

    await delay(5000);

    const status3 = await checkBlockStatus(page, 'Stage 3: 쇼핑탭 진입');
    if (status3.blocked) {
      await takeScreenshot(page, `blocked_stage3_${keyword}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }

  // Stage 4: 상품 존재 확인
  console.log('\n📍 Stage 4: 상품 목록 확인');
  try {
    const productCount = await page.$$eval(
      'a[data-shp-contents-id]',
      (els: Element[]) => els.length
    );

    console.log(`  상품 수: ${productCount}개`);

    if (productCount === 0) {
      console.log('  ⚠️ 상품이 없음 - 차단되었을 수 있음');
      await takeScreenshot(page, `no_products_${keyword}`);

      // 페이지 내용 자세히 확인
      const pageContent = await page.evaluate(() => {
        return {
          html: document.body?.innerHTML?.substring(0, 2000) || '',
          text: document.body?.innerText?.substring(0, 1000) || '',
        };
      });
      console.log('\n  📄 Page content preview:');
      console.log(pageContent.text.substring(0, 500));
    }

    const status4 = await checkBlockStatus(page, 'Stage 4: 상품 확인');
    if (status4.blocked) {
      await takeScreenshot(page, `blocked_stage4_${keyword}`);
      return false;
    }

    console.log('  ✅ 정상 - 차단 없음');
    return true;

  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔬 차단 진단 시작');
  console.log(`키워드 수: ${KEYWORDS.length}개`);
  console.log(`시작 시간: ${new Date().toLocaleString()}`);

  const { browser, page } = await connect({
    headless: false,
    turnstile: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  // 브라우저 정보 출력
  const userAgent = await page.evaluate(() => navigator.userAgent);
  console.log(`\nUser-Agent: ${userAgent}`);

  const results: { keyword: string; success: boolean }[] = [];

  for (let i = 0; i < KEYWORDS.length; i++) {
    const keyword = KEYWORDS[i];
    const success = await diagnoseKeyword(page, browser, keyword, i);
    results.push({ keyword, success });

    if (!success) {
      console.log('\n⚠️ 차단 감지됨 - 진단 중단');
      break;
    }

    // 키워드 간 대기
    if (i < KEYWORDS.length - 1) {
      console.log(`\n⏳ 다음 키워드까지 10초 대기...`);
      await delay(10000);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 진단 결과 요약');
  console.log('='.repeat(60));

  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '🛑'} ${r.keyword}`);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n성공률: ${successCount}/${results.length} (${Math.round(successCount / results.length * 100)}%)`);

  await browser.close();
  console.log('\n✅ 진단 완료');
}

main().catch(console.error);
