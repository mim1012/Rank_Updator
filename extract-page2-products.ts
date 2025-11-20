/**
 * 2페이지 상품 추출 스크립트
 *
 * 50-100위 정도의 상품 nvMid를 추출하여 테스트에 사용
 */

import { createNaverBot } from "./server/services/naverBot";

async function extractPage2Products() {
  console.log("\n🔍 2페이지 상품 추출\n");
  console.log("=".repeat(60));

  const keyword = "장난감";

  const bot = await createNaverBot(true); // Puppeteer 모드

  // @ts-ignore - page는 private이지만 디버깅용
  const page = bot['page'];

  if (!page) {
    console.error("❌ Puppeteer page not initialized");
    return;
  }

  // 2페이지로 직접 이동
  const page2Url = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=rel&pagingIndex=2&pagingSize=40&viewType=list&productSet=total&origQuery=${encodeURIComponent(keyword)}&adQuery=${encodeURIComponent(keyword)}`;

  console.log(`\n📄 Loading page 2: ${page2Url}\n`);

  await page.goto(page2Url, { waitUntil: "networkidle2" });
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for dynamic content

  const pageTitle = await page.title();
  console.log(`✅ Page loaded: ${pageTitle}\n`);

  // Debug: Check if nvMid links exist
  const htmlContainsNvMid = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    return html.includes('nvMid=');
  });
  console.log(`nvMid links in HTML: ${htmlContainsNvMid ? 'YES' : 'NO'}`);

  // Debug: Check all links
  const allLinks = await page.evaluate(() => {
    return document.querySelectorAll('a[href]').length;
  });
  console.log(`Total links on page: ${allLinks}`);

  // Extract all nvMid values
  const nvMids = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="nvMid="]'));
    return links.map((link: any, index: number) => {
      const href = link.href;
      const match = href.match(/nvMid=(\d+)/);
      return match ? {
        pagePosition: index + 1,
        absoluteRank: 40 + index + 1, // Page 2 starts at rank 41
        nvMid: match[1]
      } : null;
    }).filter(Boolean);
  });

  console.log(`📊 Found ${nvMids.length} products on page 2:\n`);

  console.log("Rank 41-45 (start of page 2):");
  nvMids.slice(0, 5).forEach((p: any) => {
    console.log(`  Rank ${p.absoluteRank}: ${p.nvMid}`);
  });

  console.log("\nRank 50-55 (middle of page 2):");
  nvMids.slice(9, 15).forEach((p: any) => {
    console.log(`  Rank ${p.absoluteRank}: ${p.nvMid}`);
  });

  console.log("\nRank 60-65:");
  nvMids.slice(19, 25).forEach((p: any) => {
    console.log(`  Rank ${p.absoluteRank}: ${p.nvMid}`);
  });

  if (nvMids.length > 0) {
    console.log(`\n\n💡 테스트 추천 상품 (페이지 2 중간):`);
    const testProduct = nvMids[Math.floor(nvMids.length / 2)];
    console.log(`   Rank ${testProduct.absoluteRank}: ${testProduct.nvMid}`);
    console.log(`\n   test-rank-check-only.ts에서 이 값으로 테스트하세요:`);
    console.log(`   productId: "${testProduct.nvMid}",  // ${testProduct.absoluteRank}위`);
  }

  await bot.close();

  console.log("\n✅ 추출 완료\n");
}

extractPage2Products()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 에러:", error);
    process.exit(1);
  });
